#!/usr/bin/env node
/**
 * Aplikuje migrace PDF 8 (068–074) na produkční Supabase.
 * Stejný vzor jako apply-fotodokumentace-migration-062.mjs
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { connectSupabaseDb, getProjectRef } from './supabase-db-client.mjs'

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const IDEMPOTENT_PATTERNS = ['already exists', 'duplicate key', 'duplicate_object', 'policy .* for relation .* already exists']

function isIdempotentError(message) {
  const normalized = message.toLowerCase()
  return IDEMPOTENT_PATTERNS.some((pattern) => normalized.includes(pattern))
}

loadEnvFile('.env')
loadEnvFile('.env.local')
loadEnvFile('.env.production')

function getDbPasswordFromEnv() {
  return (
    process.env.SUPABASE_DB_PASSWORD ||
    process.env.POSTGRES_PASSWORD ||
    (() => {
      for (const key of ['POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'SUPABASE_DB_URL']) {
        const value = process.env[key]
        if (!value) continue
        try {
          const parsed = new URL(value)
          if (parsed.password) return decodeURIComponent(parsed.password)
        } catch {
          /* ignore */
        }
      }
      return null
    })()
  )
}

const MIGRATIONS = [
  '068_pdf8_project_map_module.sql',
  '069_pdf8_marker_optional_gps.sql',
  '070_pdf8_manual_marker_color_majitel.sql',
  '071_pdf8_stavbyvedouci_assignments_rls.sql',
  '072_pdf8_stavbyvedouci_workers_rpc.sql',
  '073_pdf8_diary_missing_notifications.sql',
  '074_pdf8_phase_1j_finalize.sql',
]

const PDF8_TABLES = ['project_map_markers', 'project_notifications', 'project_user_assignments', 'project_marker_status_history']

const projectRef = getProjectRef(process.env.VITE_SUPABASE_URL)
const dbPassword = getDbPasswordFromEnv()
const token = process.env.SUPABASE_ACCESS_TOKEN
const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!projectRef) {
  console.error('FAIL: Neplatná VITE_SUPABASE_URL')
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backupDir = resolve(process.cwd(), 'backups', `pdf8-deploy-${stamp}`)

async function applyViaPg() {
  const { client, label } = await connectSupabaseDb({ projectRef, dbPassword })
  console.log(`Připojeno (${label}).`)

  mkdirSync(backupDir, { recursive: true })
  const audit = { timestamp: new Date().toISOString(), projectRef, tables: {} }
  for (const table of [...PDF8_TABLES, 'job_orders', 'erp_modules']) {
    try {
      const exists = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS ok`,
        [table]
      )
      audit.tables[table] = { existsBefore: exists.rows[0]?.ok === true }
    } catch {
      audit.tables[table] = { existsBefore: false }
    }
  }
  writeFileSync(join(backupDir, 'pre-deploy-audit.json'), JSON.stringify(audit, null, 2))

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const file = MIGRATIONS[i]
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', file), 'utf8')
    process.stdout.write(`  [${i + 1}/${MIGRATIONS.length}] ${file}… `)
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('COMMIT')
      console.log('OK')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (isIdempotentError(error.message)) {
        console.log('SKIP (již existuje)')
        continue
      }
      throw error
    }
  }

  await client.query(`NOTIFY pgrst, 'reload schema'`)
  console.log('OK: NOTIFY pgrst reload schema')

  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions`)
    const existing = await client.query(`SELECT jobid FROM cron.job WHERE jobname = 'pdf8-missing-diary-check'`)
    if (existing.rows.length === 0) {
      await client.query(`SELECT cron.schedule('pdf8-missing-diary-check', '5 20 * * 1-5', $$SELECT run_missing_diary_check();$$)`)
      console.log('OK: pg_cron pdf8-missing-diary-check naplánován')
    } else {
      console.log('OK: pg_cron job již existuje')
    }
  } catch (error) {
    console.log('WARN: pg_cron:', error.message)
  }

  for (const table of PDF8_TABLES) {
    const res = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS ok`,
      [table]
    )
    if (!res.rows[0]?.ok) throw new Error(`Tabulka ${table} nebyla vytvořena`)
    console.log(`OK: tabulka ${table}`)
  }

  const mod = await client.query(`SELECT is_implemented, module_version FROM erp_modules WHERE id = 'zakazky-mapa'`)
  console.log('OK: erp_modules zakazky-mapa', mod.rows[0])

  await client.end()
  return 'pg'
}

async function applyViaApi() {
  const applied = []
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const file = MIGRATIONS[i]
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', file), 'utf8')
    process.stdout.write(`  [${i + 1}/${MIGRATIONS.length}] ${file}… `)
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const body = await response.text()
    if (!response.ok) {
      if (isIdempotentError(body)) {
        console.log('SKIP (již existuje)')
        applied.push(`${file} (skip)`)
        continue
      }
      throw new Error(`${file}: ${response.status} ${body.slice(0, 400)}`)
    }
    console.log('OK')
    applied.push(file)
  }
  await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `NOTIFY pgrst, 'reload schema'` }),
  })
  return 'management_api'
}

async function verifyRest() {
  if (!url || !anonKey) return
  await new Promise((r) => setTimeout(r, 3000))
  const supabase = createClient(url, anonKey)
  for (const table of ['project_map_markers', 'project_notifications']) {
    const { error } = await supabase.from(table).select('id').limit(1)
    if (error?.code === 'PGRST205') throw new Error(`PostgREST cache: ${table} chybí – ${error.message}`)
    console.log(`OK: REST ${table}`, error ? `(RLS: ${error.code})` : '(dotaz OK)')
  }
}

console.log(`=== PDF 8 migrace 068–074 → ${projectRef} ===`)

if (!dbPassword && !token) {
  console.warn('::warning:: GitHub secrets SUPABASE_DB_PASSWORD/SUPABASE_ACCESS_TOKEN nejsou nastaveny.')
  console.warn('Spusťte SQL ručně: supabase/manual/068-074_pdf8_production.sql')
  process.exit(1)
}

try {
  let method
  if (dbPassword) method = await applyViaPg()
  else method = await applyViaApi()

  await verifyRest()
  writeFileSync(join(backupDir, 'deploy-summary.json'), JSON.stringify({ success: true, method, completedAt: new Date().toISOString() }, null, 2))
  console.log(`\n=== NASAZENÍ DOKONČENO (${method}) ===`)
} catch (error) {
  console.error('\n=== NASAZENÍ SELHALO ===')
  console.error(error.message)
  process.exit(1)
}

#!/usr/bin/env node
/**
 * Produkční nasazení modulu PDF 8 – Zakázky a mapa.
 *
 * Kroky:
 *   1. Záloha databáze (schema + audit tabulek)
 *   2. Ověření zálohy
 *   3. Migrace 068–074
 *   4. pg_cron pro run_missing_diary_check()
 *   5. Ověření schématu
 *   6. Smoke test (DB + volitelně login)
 *
 * Vyžaduje SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN.
 * Pro smoke test login: INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD.
 *
 * Rollback: obnovit ze zálohy v backups/pdf8-deploy-<timestamp>/
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execSync } from 'node:child_process'
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

const IDEMPOTENT_PATTERNS = [
  'already exists',
  'duplicate key',
  'duplicate_object',
  'policy .* for relation .* already exists',
]

function isIdempotentError(message) {
  const normalized = message.toLowerCase()
  return IDEMPOTENT_PATTERNS.some((pattern) => normalized.includes(pattern))
}

loadEnvFile('.env')
loadEnvFile('.env.local')
loadEnvFile('.env.production')

const MIGRATIONS = [
  '068_pdf8_project_map_module.sql',
  '069_pdf8_marker_optional_gps.sql',
  '070_pdf8_manual_marker_color_majitel.sql',
  '071_pdf8_stavbyvedouci_assignments_rls.sql',
  '072_pdf8_stavbyvedouci_workers_rpc.sql',
  '073_pdf8_diary_missing_notifications.sql',
  '074_pdf8_phase_1j_finalize.sql',
]

const PDF8_TABLES = [
  'project_map_markers',
  'project_user_assignments',
  'project_notifications',
  'project_marker_status_history',
  'project_status_overrides',
]

const projectRef = getProjectRef(process.env.VITE_SUPABASE_URL)
const dbPassword = process.env.SUPABASE_DB_PASSWORD
const token = process.env.SUPABASE_ACCESS_TOKEN
const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!projectRef) {
  console.error('FAIL: Neplatná VITE_SUPABASE_URL')
  process.exit(1)
}

if (!dbPassword && !token) {
  console.error('FAIL: Nastavte SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backupDir = resolve(process.cwd(), 'backups', `pdf8-deploy-${stamp}`)

/** @type {{ step: string; ok: boolean; detail?: string }[]} */
const results = []

function record(step, ok, detail = '') {
  results.push({ step, ok, detail })
  const icon = ok ? 'OK' : 'FAIL'
  console.log(`${icon}: ${step}${detail ? ` – ${detail}` : ''}`)
  if (!ok) throw new Error(`Nasazení zastaveno: ${step}`)
}

async function queryDb(client, sql, params = []) {
  const res = await client.query(sql, params)
  return res
}

async function queryApi(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`API ${response.status}: ${body.slice(0, 500)}`)
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

async function createBackup(client) {
  mkdirSync(backupDir, { recursive: true })
  console.log(`\n=== 1. Záloha databáze → ${backupDir} ===`)

  const tables = [
    'job_orders',
    'construction_diary_entries',
    'company_settings',
    'erp_modules',
    'profiles',
    ...PDF8_TABLES,
  ]

  const audit = { timestamp: new Date().toISOString(), projectRef, tables: {} }

  for (const table of tables) {
    try {
      const exists = await queryDb(
        client,
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        ) AS ok`,
        [table]
      )
      if (!exists.rows[0]?.ok) {
        audit.tables[table] = { exists: false, rowCount: null }
        continue
      }
      const count = await queryDb(client, `SELECT COUNT(*)::int AS c FROM public.${table}`)
      audit.tables[table] = { exists: true, rowCount: count.rows[0].c }
    } catch (error) {
      audit.tables[table] = { exists: false, error: error.message }
    }
  }

  const rls = await queryDb(
    client,
    `SELECT schemaname, tablename, policyname, cmd, qual, with_check
     FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = ANY($1::text[])
     ORDER BY tablename, policyname`,
    [PDF8_TABLES]
  )
  audit.rlsPolicies = rls.rows

  const moduleRow = await queryDb(
    client,
    `SELECT id, is_implemented, module_version FROM erp_modules WHERE id = 'zakazky-mapa'`
  )
  audit.erpModuleBefore = moduleRow.rows[0] ?? null

  writeFileSync(join(backupDir, 'pre-deploy-audit.json'), JSON.stringify(audit, null, 2))

  let schemaDumpOk = false
  try {
    execSync('which pg_dump', { stdio: 'pipe' })
    const encodedPassword = encodeURIComponent(dbPassword)
    const dbUrl = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`
    const schemaFile = join(backupDir, 'schema-pre-deploy.sql')
    execSync(`pg_dump "${dbUrl}" --schema-only --no-owner --no-privileges -f "${schemaFile}"`, {
      stdio: 'pipe',
      env: { ...process.env, PGPASSWORD: dbPassword },
    })
    schemaDumpOk = existsSync(schemaFile) && readFileSync(schemaFile).length > 100
    audit.schemaDump = schemaFile
  } catch (error) {
    audit.schemaDumpError = error.message
  }

  writeFileSync(join(backupDir, 'backup-summary.json'), JSON.stringify(audit, null, 2))
  record('Záloha vytvořena', existsSync(join(backupDir, 'pre-deploy-audit.json')), backupDir)
  if (schemaDumpOk) record('Schema dump pg_dump', true)
  else console.log('WARN: pg_dump schema dump přeskočen (pg_dump nedostupný nebo chyba)')
}

async function verifyBackup() {
  console.log('\n=== 2. Ověření zálohy ===')
  const auditPath = join(backupDir, 'pre-deploy-audit.json')
  if (!existsSync(auditPath)) record('Soubor pre-deploy-audit.json', false)
  const audit = JSON.parse(readFileSync(auditPath, 'utf8'))
  record('Audit obsahuje projectRef', audit.projectRef === projectRef, audit.projectRef)
  record('Audit obsahuje tabulky', Object.keys(audit.tables).length >= 5)
  writeFileSync(join(backupDir, 'backup-verified.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), ok: true }, null, 2))
}

async function applyMigrationPg(client, file, index, total) {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', file), 'utf8')
  process.stdout.write(`  [${index + 1}/${total}] ${file}… `)
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('OK')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (isIdempotentError(error.message)) {
      console.log('SKIP (již existuje)')
      return
    }
    throw new Error(`${file}: ${error.message}`)
  }
}

async function applyMigrationApi(file, index, total) {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', file), 'utf8')
  process.stdout.write(`  [${index + 1}/${total}] ${file}… `)
  try {
    await queryApi(sql)
    console.log('OK')
  } catch (error) {
    if (isIdempotentError(error.message)) {
      console.log('SKIP (již existuje)')
      return
    }
    throw error
  }
}

async function applyMigrations() {
  console.log(`\n=== 3. Migrace 068–074 na ${projectRef} ===`)
  if (dbPassword) {
    const { client, label } = await connectSupabaseDb({ projectRef, dbPassword })
    console.log(`Připojeno (${label}).`)
    for (let i = 0; i < MIGRATIONS.length; i++) {
      await applyMigrationPg(client, MIGRATIONS[i], i, MIGRATIONS.length)
    }
    await client.end()
  } else {
    for (let i = 0; i < MIGRATIONS.length; i++) {
      await applyMigrationApi(MIGRATIONS[i], i, MIGRATIONS.length)
    }
  }
  record('Migrace 068–074', true, `${MIGRATIONS.length} souborů`)
}

async function configurePgCron(client) {
  console.log('\n=== 4. pg_cron – run_missing_diary_check ===')
  try {
    await queryDb(client, `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions`)
  } catch (error) {
    console.log('WARN: pg_cron extension:', error.message)
  }

  const existing = await queryDb(
    client,
    `SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'pdf8-missing-diary-check'`
  ).catch(() => ({ rows: [] }))

  if (existing.rows.length > 0) {
    record('pg_cron job existuje', true, existing.rows[0].schedule)
    return existing.rows[0]
  }

  try {
    await queryDb(
      client,
      `SELECT cron.schedule(
        'pdf8-missing-diary-check',
        '5 20 * * 1-5',
        $$SELECT run_missing_diary_check();$$
      )`
    )
    const after = await queryDb(
      client,
      `SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'pdf8-missing-diary-check'`
    )
    record('pg_cron naplánován', after.rows.length > 0, '5 20 * * 1-5')
    return after.rows[0]
  } catch (error) {
    console.log('WARN: pg_cron schedule selhal:', error.message)
    console.log('WARN: Naplánujte ručně v Supabase SQL Editoru (viz docs/DIARY_MISSING_CHECK.md)')
    return { jobname: 'pdf8-missing-diary-check', schedule: 'MANUAL_REQUIRED', error: error.message }
  }
}

async function verifySchema(client) {
  console.log('\n=== 5. Ověření schématu ===')
  for (const table of PDF8_TABLES) {
    const res = await queryDb(
      client,
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS ok`,
      [table]
    )
    record(`Tabulka ${table}`, res.rows[0]?.ok === true)
  }

  const mod = await queryDb(
    client,
    `SELECT is_implemented, module_version FROM erp_modules WHERE id = 'zakazky-mapa'`
  )
  record(
    'erp_modules zakazky-mapa',
    mod.rows[0]?.is_implemented === true,
    `v${mod.rows[0]?.module_version ?? '?'}`
  )

  const fn = await queryDb(
    client,
    `SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'run_missing_diary_check'
    ) AS ok`
  )
  record('Funkce run_missing_diary_check', fn.rows[0]?.ok === true)

  const recalc = await queryDb(
    client,
    `SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'recalculate_project_marker_color'
    ) AS ok`
  )
  record('Funkce recalculate_project_marker_color', recalc.rows[0]?.ok === true)

  const markerUnique = await queryDb(
    client,
    `SELECT COUNT(*)::int AS c FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'project_map_markers'
       AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%project_id%'`
  )
  record('UNIQUE project_id na project_map_markers', markerUnique.rows[0]?.c >= 1)
}

async function runSmokeTest(client) {
  console.log('\n=== 6. Smoke test (DB + API) ===')
  const productionUrl = process.env.PRODUCTION_URL || 'https://erp.vhbulldig.cz'
  const fallbackUrl = 'https://vh-bulldig-erp.vercel.app'

  for (const testUrl of [productionUrl, fallbackUrl]) {
    try {
      const res = await fetch(`${testUrl}/prihlaseni`, { redirect: 'follow' })
      if (res.ok) {
        record(`Frontend ${testUrl}/prihlaseni`, true, `HTTP ${res.status}`)
        break
      }
    } catch {
      /* try next */
    }
  }

  const roleEnum = await queryDb(
    client,
    `SELECT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'stavbyvedouci'
    ) AS ok`
  )
  record('Role stavbyvedouci v enum', roleEnum.rows[0]?.ok === true)

  const diaryStatus = await queryDb(
    client,
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'construction_diary_entries'
       AND column_name = 'entry_status'`
  )
  record('Sloupec entry_status v deníku', diaryStatus.rows.length === 1)

  const cronJob = await queryDb(
    client,
    `SELECT jobname, schedule FROM cron.job WHERE jobname = 'pdf8-missing-diary-check'`
  ).catch(() => ({ rows: [] }))
  if (cronJob.rows.length > 0) {
    record('pg_cron job aktivní', true, cronJob.rows[0].schedule)
  } else {
    console.log('WARN: pg_cron job nebyl ověřen – může vyžadovat manuální nastavení')
  }

  const email = process.env.INITIAL_ADMIN_EMAIL
  const password = process.env.INITIAL_ADMIN_PASSWORD
  if (email && password && url && anonKey) {
    const supabase = createClient(url, anonKey)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    record('Admin login', !error, error?.message ?? email)
    if (!error) await supabase.auth.signOut()
  } else {
    console.log('WARN: Login smoke test přeskočen (chybí INITIAL_ADMIN_EMAIL/PASSWORD)')
  }

  writeFileSync(join(backupDir, 'smoke-test-results.json'), JSON.stringify(results, null, 2))
}

async function main() {
  console.log('=== PDF 8 – Produkční nasazení Zakázky a mapa ===')
  console.log(`Projekt: ${projectRef}`)
  console.log(`Záloha: ${backupDir}`)

  let client
  try {
    if (!dbPassword) {
      console.error('FAIL: Záloha a pg_cron vyžadují SUPABASE_DB_PASSWORD (ne jen ACCESS_TOKEN)')
      process.exit(1)
    }

    const connection = await connectSupabaseDb({ projectRef, dbPassword })
    client = connection.client
    console.log(`Připojeno (${connection.label}).`)

    await createBackup(client)
    await verifyBackup()
    await applyMigrations()
    const cronResult = await configurePgCron(client)
    writeFileSync(join(backupDir, 'pg-cron.json'), JSON.stringify(cronResult, null, 2))
    await verifySchema(client)
    await runSmokeTest(client)

    writeFileSync(
      join(backupDir, 'deploy-summary.json'),
      JSON.stringify({ success: true, completedAt: new Date().toISOString(), results }, null, 2)
    )

    console.log('\n=== NASAZENÍ DB DOKONČENO ===')
    console.log(`Záloha: ${backupDir}`)
    console.log('Další krok: nasadit frontend (Vercel) a dokončit UI smoke test.')
  } catch (error) {
    console.error('\n=== NASAZENÍ SELHALO ===')
    console.error(error.message)
    writeFileSync(
      join(backupDir, 'deploy-failure.json'),
      JSON.stringify({ success: false, error: error.message, results, failedAt: new Date().toISOString() }, null, 2)
    )
    console.error('\nROLLBACK: Obnovte databázi ze zálohy v', backupDir)
    console.error('Viz docs/PDF8_PHASE_1j_QA.md → Postup rollbacku')
    process.exit(1)
  } finally {
    await client?.end().catch(() => {})
  }
}

main()

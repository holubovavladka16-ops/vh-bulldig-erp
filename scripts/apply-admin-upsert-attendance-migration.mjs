/**
 * Aplikuje migraci 052_admin_upsert_attendance_p_status.sql na produkční Supabase.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
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

loadEnvFile('.env')
loadEnvFile('.env.local')

const migrationPath = resolve(process.cwd(), 'supabase/migrations/052_admin_upsert_attendance_p_status.sql')
const sql = readFileSync(migrationPath, 'utf8')
const url = process.env.VITE_SUPABASE_URL
const token = process.env.SUPABASE_ACCESS_TOKEN
const projectRef = getProjectRef(url)

if (!projectRef) {
  console.error('FAIL: Neplatná VITE_SUPABASE_URL')
  process.exit(1)
}

async function verifySignature(client) {
  const res = await client.query(`
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_upsert_attendance'
    ORDER BY args
  `)
  console.log('Signatury admin_upsert_attendance:')
  for (const row of res.rows) {
    console.log('  -', row.args)
  }
  if (res.rows.length !== 1) {
    throw new Error(`Očekávána právě 1 signatura, nalezeno ${res.rows.length}`)
  }
  if (!String(res.rows[0].args).includes('p_status')) {
    throw new Error('Signatura neobsahuje p_status')
  }
}

async function applyViaPg() {
  const { client } = await connectSupabaseDb({
    projectRef,
    dbPassword: process.env.SUPABASE_DB_PASSWORD,
  })
  await client.query(sql)
  await verifySignature(client)
  await client.end()
  console.log('OK: Migrace 052_admin_upsert_attendance_p_status aplikována + schema reload.')
}

if (process.env.SUPABASE_DB_PASSWORD) {
  await applyViaPg()
} else if (token) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!response.ok) {
    console.error('FAIL:', response.status, await response.text())
    process.exit(1)
  }
  console.log('OK: Migrace 052 aplikována přes Management API + NOTIFY pgrst.')
} else {
  console.error('FAIL: Chybí SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

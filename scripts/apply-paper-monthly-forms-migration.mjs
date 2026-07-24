/**
 * Aplikuje migraci 053_paper_monthly_forms.sql na produkční Supabase.
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

const migrationPath = resolve(process.cwd(), 'supabase/migrations/053_paper_monthly_forms.sql')
const sql = readFileSync(migrationPath, 'utf8')
const url = process.env.VITE_SUPABASE_URL
const token = process.env.SUPABASE_ACCESS_TOKEN
const projectRef = getProjectRef(url)

if (!projectRef) {
  console.error('FAIL: Neplatná VITE_SUPABASE_URL')
  process.exit(1)
}

async function verify(client) {
  const tables = ['paper_monthly_forms', 'paper_monthly_form_lines']
  for (const table of tables) {
    const res = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    )
    if (res.rowCount === 0) throw new Error(`Tabulka ${table} neexistuje`)
  }
  console.log('OK: Tabulky paper_monthly_* existují')
}

async function applyViaPg() {
  const { client } = await connectSupabaseDb({
    projectRef,
    dbPassword: process.env.SUPABASE_DB_PASSWORD,
  })
  await client.query(sql)
  await verify(client)
  await client.end()
  console.log('OK: Migrace 053_paper_monthly_forms aplikována.')
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
  console.log('OK: Migrace 053 odeslána přes Supabase API.')
} else {
  console.error('FAIL: Nastavte SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

/**
 * Aplikuje migraci 054_paper_attendance_enhancements.sql
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

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/054_paper_attendance_enhancements.sql'), 'utf8')
const projectRef = getProjectRef(process.env.VITE_SUPABASE_URL)

if (!projectRef) {
  console.error('FAIL: Neplatná VITE_SUPABASE_URL')
  process.exit(1)
}

async function applyViaPg() {
  const { client } = await connectSupabaseDb({
    projectRef,
    dbPassword: process.env.SUPABASE_DB_PASSWORD,
  })
  await client.query(sql)
  await client.end()
  console.log('OK: Migrace 054 aplikována.')
}

if (process.env.SUPABASE_DB_PASSWORD) {
  await applyViaPg()
} else if (process.env.SUPABASE_ACCESS_TOKEN) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!response.ok) {
    console.error('FAIL:', response.status, await response.text())
    process.exit(1)
  }
  console.log('OK: Migrace 054 odeslána.')
} else {
  console.error('FAIL: Chybí SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

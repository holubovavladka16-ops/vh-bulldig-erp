/**
 * Aplikuje migraci 056_paper_form_v2_columns.sql
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

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/056_paper_form_v2_columns.sql'), 'utf8')
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
  console.log('OK: Migrace 056 aplikována.')
}

applyViaPg().catch((err) => {
  console.error('FAIL:', err.message ?? err)
  process.exit(1)
})

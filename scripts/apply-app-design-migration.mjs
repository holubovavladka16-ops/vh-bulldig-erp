/**
 * Aplikuje pouze migraci 044_app_design.sql na Supabase Cloud.
 * Vyžaduje SUPABASE_ACCESS_TOKEN nebo SUPABASE_DB_PASSWORD v .env.local
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

const migrationPath = resolve(process.cwd(), 'supabase/migrations/044_app_design.sql')
const sql = readFileSync(migrationPath, 'utf8')
const url = process.env.VITE_SUPABASE_URL
const token = process.env.SUPABASE_ACCESS_TOKEN
const projectRef = getProjectRef(url)

if (!projectRef) {
  console.error('FAIL: Neplatná VITE_SUPABASE_URL')
  process.exit(1)
}

async function applyViaManagementApi() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const body = await response.text()
  if (!response.ok) {
    console.error('FAIL:', response.status, body.slice(0, 500))
    process.exit(1)
  }
  console.log('OK: Migrace 044_app_design aplikována přes Management API.')
}

async function applyViaPg() {
  const { client } = await connectSupabaseDb({
    projectRef,
    dbPassword: process.env.SUPABASE_DB_PASSWORD,
  })
  await client.query(sql)
  await client.end()
  console.log('OK: Migrace 044_app_design aplikována přes PostgreSQL.')
}

if (token) {
  await applyViaManagementApi()
} else if (process.env.SUPABASE_DB_PASSWORD) {
  await applyViaPg()
} else {
  console.error('FAIL: Chybí SUPABASE_ACCESS_TOKEN nebo SUPABASE_DB_PASSWORD v .env.local')
  console.error('Token: https://supabase.com/dashboard/account/tokens')
  console.error('Heslo: https://supabase.com/dashboard/project/khhalcjgvqoyskkjlkyg/settings/database')
  process.exit(1)
}

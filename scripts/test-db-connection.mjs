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

const url = process.env.VITE_SUPABASE_URL
const dbPassword = process.env.SUPABASE_DB_PASSWORD

if (!url || !dbPassword) {
  console.error('FAIL: Chybí VITE_SUPABASE_URL nebo SUPABASE_DB_PASSWORD v .env.local')
  process.exit(1)
}

const projectRef = getProjectRef(url)
if (!projectRef) {
  console.error('FAIL: Neplatná VITE_SUPABASE_URL')
  process.exit(1)
}

try {
  const { label } = await connectSupabaseDb({ projectRef, dbPassword })
  console.log(`OK: Připojení funguje (${label}).`)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

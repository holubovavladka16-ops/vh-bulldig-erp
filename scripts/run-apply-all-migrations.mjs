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
const sqlFile = resolve(process.cwd(), 'supabase/apply-all-migrations.sql')

if (!existsSync(sqlFile)) {
  console.error('FAIL: Chybí supabase/apply-all-migrations.sql')
  console.error('Spusťte nejdřív: node scripts/build-apply-all-sql.mjs')
  process.exit(1)
}

if (!url) {
  console.error('FAIL: Chybí VITE_SUPABASE_URL v .env.local')
  process.exit(1)
}

const projectRef = getProjectRef(url)
if (!projectRef) {
  console.error('FAIL: Neplatná VITE_SUPABASE_URL:', url)
  process.exit(1)
}

if (!dbPassword) {
  console.error('FAIL: Chybí SUPABASE_DB_PASSWORD v .env.local')
  console.error('Heslo k databázi najdete v Supabase Dashboard → Project Settings → Database.')
  process.exit(1)
}

console.log(`Spouštím apply-all-migrations.sql na projekt ${projectRef}…`)

let client
try {
  const connection = await connectSupabaseDb({ projectRef, dbPassword })
  client = connection.client
  console.log(`Připojeno (${connection.label}).`)
  const sql = readFileSync(sqlFile, 'utf8')
  await client.query(sql)
  console.log('OK: apply-all-migrations.sql proběhl bez chyby.')
} catch (error) {
  console.error('FAIL:', error.message)
  process.exit(1)
} finally {
  await client?.end().catch(() => {})
}

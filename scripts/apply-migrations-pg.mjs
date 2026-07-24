import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
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
]

function isIdempotentError(message) {
  const normalized = message.toLowerCase()
  return IDEMPOTENT_PATTERNS.some((pattern) => normalized.includes(pattern))
}

loadEnvFile('.env')
loadEnvFile('.env.local')

const url = process.env.VITE_SUPABASE_URL
const dbPassword = process.env.SUPABASE_DB_PASSWORD
const migrationsDir = resolve(process.cwd(), 'supabase/migrations')

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
  console.error('Heslo: Supabase Dashboard → Project Settings → Database → Database password')
  process.exit(1)
}

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()

console.log(`Aplikuji ${files.length} migrací na projekt ${projectRef}…`)

let client
try {
  const connection = await connectSupabaseDb({ projectRef, dbPassword })
  client = connection.client
  console.log(`Připojeno (${connection.label}).`)

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    process.stdout.write(`  [${i + 1}/${files.length}] ${file}… `)

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
      console.error('\nFAIL:', file)
      console.error(error.message)
      process.exit(1)
    }
  }

  console.log('OK: Všechny migrace aplikovány.')
} catch (error) {
  console.error('FAIL:', error.message)
  if (error.message.includes('password authentication failed')) {
    console.error('')
    console.error('Heslo k databázi neodpovídá projektu.')
    console.error('Supabase Dashboard → Settings → Database → Reset database password')
    console.error('Poté aktualizujte SUPABASE_DB_PASSWORD v .env.local a spusťte znovu npm run setup-complete')
  }
  process.exit(1)
} finally {
  await client?.end().catch(() => {})
}

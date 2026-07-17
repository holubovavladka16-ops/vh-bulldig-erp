/**
 * Aplikuje migrace 060–061 (modul Kontrola formuláře) na produkční Supabase.
 * Vyžaduje SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN v prostředí.
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

const IDEMPOTENT_PATTERNS = ['already exists', 'duplicate key', 'duplicate_object']

function isIdempotentError(message) {
  const normalized = message.toLowerCase()
  return IDEMPOTENT_PATTERNS.some((pattern) => normalized.includes(pattern))
}

loadEnvFile('.env')
loadEnvFile('.env.local')
loadEnvFile('.env.production')

const MIGRATIONS = ['060_form_check_records.sql', '061_form_check_phase5.sql']

const projectRef = getProjectRef(process.env.VITE_SUPABASE_URL)
const dbPassword = process.env.SUPABASE_DB_PASSWORD
const token = process.env.SUPABASE_ACCESS_TOKEN

if (!projectRef) {
  console.error('FAIL: Neplatná VITE_SUPABASE_URL')
  process.exit(1)
}

async function applyViaPg() {
  const { client, label } = await connectSupabaseDb({ projectRef, dbPassword })
  console.log(`Připojeno (${label}).`)

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
      console.error('\nFAIL:', file, error.message)
      process.exit(1)
    }
  }

  await client.end()
}

async function applyViaApi() {
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const file = MIGRATIONS[i]
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', file), 'utf8')
    process.stdout.write(`  [${i + 1}/${MIGRATIONS.length}] ${file}… `)

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
      if (isIdempotentError(body)) {
        console.log('SKIP (již existuje)')
        continue
      }
      console.error('\nFAIL:', file, response.status, body.slice(0, 500))
      process.exit(1)
    }
    console.log('OK')
  }
}

async function verifySchema() {
  if (!dbPassword) {
    console.log('Ověření schématu přes DB přeskočeno (chybí SUPABASE_DB_PASSWORD).')
    return
  }

  const { client } = await connectSupabaseDb({ projectRef, dbPassword })
  const table = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'form_check_records'
    ORDER BY ordinal_position
  `)
  const columns = table.rows.map((r) => r.column_name)
  const required = ['id', 'form_id', 'worker_id', 'outcome', 'ocr_confidence', 'form_number']
  const missing = required.filter((c) => !columns.includes(c))
  if (missing.length > 0) {
    console.error('FAIL: Chybí sloupce v form_check_records:', missing.join(', '))
    process.exit(1)
  }
  console.log('OK: Tabulka form_check_records existuje se sloupci:', columns.join(', '))
  await client.end()
}

console.log(`Aplikuji migrace 060–061 na projekt ${projectRef}…`)

if (dbPassword) {
  await applyViaPg()
} else if (token) {
  await applyViaApi()
} else {
  console.error('FAIL: Nastavte SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

await verifySchema()
console.log('OK: Migrace 060–061 aplikovány.')

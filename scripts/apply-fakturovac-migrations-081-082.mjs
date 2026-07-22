/**
 * Aplikuje migrace 081–082 (modul Fakturovač) na produkční Supabase.
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

const MIGRATIONS = ['081_fakturovac_module.sql', '082_fakturovac_storage_update.sql']

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
  const tables = ['issued_invoices', 'issued_invoice_lines', 'invoice_settings']
  for (const table of tables) {
    const result = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    )
    if (result.rowCount === 0) {
      console.error(`FAIL: Tabulka ${table} neexistuje`)
      process.exit(1)
    }
    console.log(`OK: Tabulka ${table} existuje`)
  }

  const module = await client.query(`SELECT id FROM erp_modules WHERE id = 'fakturovac'`)
  if (module.rowCount === 0) {
    console.error('FAIL: Modul fakturovac není v erp_modules')
    process.exit(1)
  }
  console.log('OK: Modul fakturovac registrován v erp_modules')

  await client.end()
}

console.log(`Aplikuji migrace Fakturovač (081–082) na projekt ${projectRef}…`)

if (dbPassword) {
  await applyViaPg()
} else if (token) {
  await applyViaApi()
} else {
  console.error('FAIL: Nastavte SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

await verifySchema()
console.log('OK: Migrace Fakturovač aplikovány.')

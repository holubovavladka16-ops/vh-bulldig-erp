/**
 * Aplikuje migraci 062 (modul Fotodokumentace s GPS) na produkční Supabase.
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

const MIGRATION = '062_fotodokumentace_modul.sql'

const REQUIRED_GPS_PHOTOS_COLUMNS = [
  'photo_type',
  'gps_status',
  'approval_status',
  'sync_status',
  'series_id',
  'paired_photo_id',
  'thumbnail_path',
  'original_file_path',
  'watermarked_file_path',
  'map_url',
  'district',
  'region',
  'uploaded_at',
  'approved_by',
  'approved_at',
  'deleted_at',
  'deleted_by',
  'delete_reason',
]

const REQUIRED_TABLES = [
  'gps_photo_types',
  'gps_photo_series',
  'gps_photo_audit_log',
  'gps_photo_public_galleries',
]

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

  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', MIGRATION), 'utf8')
  process.stdout.write(`  Aplikuji ${MIGRATION}… `)

  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('OK')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (isIdempotentError(error.message)) {
      console.log('SKIP (již existuje)')
    } else {
      console.error('\nFAIL:', error.message)
      await client.end()
      process.exit(1)
    }
  }

  await verifySchema(client)
  await client.end()
}

async function applyViaApi() {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', MIGRATION), 'utf8')
  process.stdout.write(`  Aplikuji ${MIGRATION}… `)

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
    } else {
      console.error('\nFAIL:', response.status, body.slice(0, 500))
      process.exit(1)
    }
  } else {
    console.log('OK')
  }

  if (dbPassword) {
    const { client } = await connectSupabaseDb({ projectRef, dbPassword })
    await verifySchema(client)
    await client.end()
  } else {
    console.log('Ověření schématu přes DB přeskočeno (chybí SUPABASE_DB_PASSWORD).')
  }
}

async function verifySchema(client) {
  const columnsResult = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gps_photos'
    ORDER BY ordinal_position
  `)
  const columns = columnsResult.rows.map((r) => r.column_name)
  const missing = REQUIRED_GPS_PHOTOS_COLUMNS.filter((c) => !columns.includes(c))
  if (missing.length > 0) {
    console.error('FAIL: Chybí sloupce v gps_photos:', missing.join(', '))
    process.exit(1)
  }
  console.log('OK: gps_photos obsahuje nové sloupce včetně approval_status, gps_status, …')

  for (const table of REQUIRED_TABLES) {
    const tableResult = await client.query(
      `SELECT to_regclass($1) AS reg`,
      [`public.${table}`]
    )
    if (!tableResult.rows[0]?.reg) {
      console.error(`FAIL: Tabulka ${table} neexistuje`)
      process.exit(1)
    }
  }
  console.log('OK: Pomocné tabulky existují:', REQUIRED_TABLES.join(', '))

  const latNullable = await client.query(`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gps_photos' AND column_name = 'gps_lat'
  `)
  if (latNullable.rows[0]?.is_nullable !== 'YES') {
    console.error('FAIL: gps_lat musí být nullable po migraci 062')
    process.exit(1)
  }
  console.log('OK: gps_lat/gps_lng jsou volitelné (uložení bez GPS)')
}

console.log(`Aplikuji migraci 062 na projekt ${projectRef}…`)

if (dbPassword) {
  await applyViaPg()
} else if (token) {
  await applyViaApi()
} else {
  console.error('FAIL: Nastavte SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

console.log('OK: Migrace 062 aplikována a ověřena.')

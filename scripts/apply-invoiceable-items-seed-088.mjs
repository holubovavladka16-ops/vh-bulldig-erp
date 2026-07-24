/**
 * Aplikuje seed ceníku položek (migrace 088) na Supabase.
 * 1) DB migrace (SUPABASE_DB_PASSWORD / POSTGRES_URL / SUPABASE_ACCESS_TOKEN)
 * 2) REST insert s přihlášením admina (INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD)
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { connectSupabaseDb, getProjectRef } from './supabase-db-client.mjs'
import { INVOICEABLE_SEED_ITEMS, INVOICEABLE_SEED_EXPECTED_COUNT } from '../api/lib/invoiceable-items-seed-data.js'

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

const MIGRATION_FILE = '088_invoiceable_items_seed.sql'
const IDEMPOTENT_PATTERNS = ['already exists', 'duplicate key', 'duplicate_object']

function isIdempotentError(message) {
  const normalized = message.toLowerCase()
  return IDEMPOTENT_PATTERNS.some((pattern) => normalized.includes(pattern))
}

loadEnvFile('.env')
loadEnvFile('.env.local')
loadEnvFile('.env.production')

if (process.env.POSTGRES_URL && !process.env.SUPABASE_DB_URL) {
  process.env.SUPABASE_DB_URL = process.env.POSTGRES_URL
}
if (process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
  process.env.SUPABASE_DB_URL = process.env.DATABASE_URL
}

const projectRef = getProjectRef(process.env.VITE_SUPABASE_URL)
const dbPassword = process.env.SUPABASE_DB_PASSWORD
const token = process.env.SUPABASE_ACCESS_TOKEN
const connectionString = process.env.SUPABASE_DB_URL
const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? process.env.VITE_INITIAL_ADMIN_EMAIL
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD

async function applyViaConnectionString() {
  if (!connectionString) return false
  const pg = await import('pg')
  const client = new pg.default.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', MIGRATION_FILE), 'utf8')
  process.stdout.write(`  ${MIGRATION_FILE} (connection string)… `)
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
      throw error
    }
  }
  await client.end()
  return true
}

async function applyViaPg() {
  const { client, label } = await connectSupabaseDb({ projectRef, dbPassword })
  console.log(`Připojeno (${label}).`)
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', MIGRATION_FILE), 'utf8')
  process.stdout.write(`  ${MIGRATION_FILE}… `)
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
      throw error
    }
  }
  await client.end()
}

async function applyViaManagementApi() {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations', MIGRATION_FILE), 'utf8')
  process.stdout.write(`  ${MIGRATION_FILE} (Management API)… `)
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
      return
    }
    throw new Error(`${response.status} ${body.slice(0, 500)}`)
  }
  console.log('OK')
}

async function applyViaRest() {
  if (!url || !anonKey) throw new Error('Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY')
  if (!adminEmail || !adminPassword) {
    throw new Error('Chybí INITIAL_ADMIN_EMAIL nebo INITIAL_ADMIN_PASSWORD pro REST seed')
  }

  const supabase = createClient(url, anonKey)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (error || !data.session) {
    throw new Error(error?.message ?? 'Přihlášení admina selhalo')
  }

  const authed = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  })

  let inserted = 0
  let skipped = 0
  for (const item of INVOICEABLE_SEED_ITEMS) {
    const { error: insertError } = await authed.from('invoiceable_items').insert(item)
    if (insertError) {
      if (insertError.code === '23505') {
        skipped += 1
        continue
      }
      throw new Error(`${item.name}: ${insertError.message}`)
    }
    inserted += 1
  }

  console.log(`REST seed: vloženo ${inserted}, přeskočeno ${skipped} (duplicitní)`)
}

async function verifyCount() {
  if (!url || !anonKey || !adminEmail || !adminPassword) return null
  const supabase = createClient(url, anonKey)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (error || !data.session) return null

  const authed = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  })
  const { count, error: countError } = await authed
    .from('invoiceable_items')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (countError) throw new Error(countError.message)
  return count ?? 0
}

console.log(`Aplikuji seed ceníku Fakturační výkaz prací (${INVOICEABLE_SEED_EXPECTED_COUNT} položek)…`)

try {
  if (await applyViaConnectionString()) {
    // hotovo
  } else if (dbPassword) {
    await applyViaPg()
  } else if (token) {
    await applyViaManagementApi()
  } else {
    await applyViaRest()
  }
} catch (error) {
  if (dbPassword || token || connectionString) {
    console.warn('DB seed selhal, zkouším REST s admin přihlášením…', error.message)
    await applyViaRest()
  } else {
    throw error
  }
}

const count = await verifyCount()
if (count !== null) {
  if (count >= INVOICEABLE_SEED_EXPECTED_COUNT) {
    console.log(`OK: Aktivních položek v ceníku: ${count}`)
  } else {
    console.error(`FAIL: Očekáváno alespoň ${INVOICEABLE_SEED_EXPECTED_COUNT}, nalezeno ${count}`)
    process.exit(1)
  }
} else {
  console.log('OK: Seed aplikován (ověření počtu přeskočeno – chybí admin credentials).')
}

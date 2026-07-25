/**
 * Ověří, že ceník Fakturačního výkazu prací obsahuje všech 42 seed položek.
 * Vyžaduje INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD (nebo VITE_* + admin heslo).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { INVOICEABLE_SEED_ITEMS, INVOICEABLE_SEED_EXPECTED_COUNT } from '../server/lib/invoiceable-items-seed-data.js'

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
loadEnvFile('.env.production')

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? process.env.VITE_INITIAL_ADMIN_EMAIL
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD

if (!url || !anonKey || !adminEmail || !adminPassword) {
  console.error('FAIL: Chybí VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, admin e-mail nebo heslo')
  process.exit(1)
}

const supabase = createClient(url, anonKey)
const { data, error } = await supabase.auth.signInWithPassword({
  email: adminEmail,
  password: adminPassword,
})
if (error || !data.session) {
  console.error('FAIL: Přihlášení selhalo:', error?.message)
  process.exit(1)
}

const authed = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
})

const { data: items, error: itemsError } = await authed
  .from('invoiceable_items')
  .select('name, unit, category, is_active')
  .eq('is_active', true)
  .order('name')

if (itemsError) {
  console.error('FAIL:', itemsError.message)
  process.exit(1)
}

const active = items ?? []
const names = new Set(active.map((i) => i.name))
const missing = INVOICEABLE_SEED_ITEMS.filter((item) => !names.has(item.name))

console.log(`Aktivních položek: ${active.length} (očekáváno ${INVOICEABLE_SEED_EXPECTED_COUNT})`)

if (missing.length > 0) {
  console.error('FAIL: Chybí položky:')
  for (const item of missing) console.error(`  - ${item.name}`)
  process.exit(1)
}

for (const expected of INVOICEABLE_SEED_ITEMS) {
  const row = active.find((i) => i.name === expected.name)
  if (!row || row.unit !== expected.unit || row.category !== expected.category) {
    console.error(`FAIL: Nesoulad u položky „${expected.name}“`)
    process.exit(1)
  }
}

console.log('OK: Všech 42 položek je v ceníku a lze je vybrat ve Fakturačním výkazu práce.')

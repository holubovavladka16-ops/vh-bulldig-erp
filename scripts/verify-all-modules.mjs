/**
 * Ověření všech hlavních modulů přes Supabase API.
 * Spusťte: node scripts/verify-all-modules.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

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
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? process.env.VITE_INITIAL_ADMIN_EMAIL
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD

if (!url || !anonKey || !adminEmail || !adminPassword) {
  console.error('FAIL: Chybí proměnné v .env.local')
  process.exit(1)
}

const supabase = createClient(url, anonKey)
const results = []

function pass(name) {
  results.push({ name, ok: true })
  console.log(`  OK  ${name}`)
}

function fail(name, detail) {
  results.push({ name, ok: false, detail })
  console.error(`  FAIL ${name}: ${detail}`)
}

async function rpc(fn, params = {}) {
  const { data, error } = await supabase.rpc(fn, params)
  return { ok: !error, data, error: error?.message }
}

console.log('=== OVĚŘENÍ VŠECH MODULŮ ===\n')

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: adminEmail,
  password: adminPassword,
})
if (authErr || !auth.session) {
  fail('Přihlášení', authErr?.message ?? 'bez session')
  process.exit(1)
}
pass('Přihlášení')

const checks = [
  { name: 'Dělníci', table: 'workers', select: 'id', limit: 1 },
  { name: 'Docházka', table: 'worker_attendance_records', select: 'id', limit: 1 },
  { name: 'Denní formuláře', table: 'worker_daily_forms', select: 'id', limit: 1 },
  { name: 'Zakázky', table: 'job_orders', select: 'id', limit: 1 },
  { name: 'Výkazy', table: 'worker_reports', select: 'id', limit: 1 },
  { name: 'Výplatní pásky (RPC)', rpc: 'get_payroll_slip_summaries', params: { p_date_from: '2026-01-01', p_date_to: '2026-12-31', p_worker_id: null, p_include_pending: true } },
  { name: 'Stavební deník', table: 'construction_diary_entries', select: 'id', limit: 1 },
  { name: 'Náklady', table: 'job_costs', select: 'id', limit: 1 },
  { name: 'Smlouvy (dokumenty)', table: 'worker_documents', select: 'id', limit: 1 },
  { name: 'Paragony', table: 'receipts', select: 'id', limit: 1 },
  { name: 'Přípojky', table: 'utility_connections', select: 'id', limit: 1 },
  { name: 'Mapa výkopů', table: 'excavation_routes', select: 'id', limit: 1 },
  { name: 'Firemní údaje', table: 'company_settings', select: 'id', limit: 1 },
]

for (const check of checks) {
  if (check.rpc) {
    const res = await rpc(check.rpc, check.params)
    res.ok ? pass(check.name) : fail(check.name, res.error ?? JSON.stringify(res.data))
    continue
  }
  const { error } = await supabase.from(check.table).select(check.select).limit(check.limit)
  error ? fail(check.name, error.message) : pass(check.name)
}

const profit = await rpc('get_profit_overview', {
  p_order_id: null,
  p_date_from: '2026-01-01',
  p_date_to: '2026-12-31',
})
profit.ok && Array.isArray(profit.data) ? pass('Přehled zisku') : fail('Přehled zisku', profit.error ?? '')

await supabase.auth.signOut()

const failed = results.filter((r) => !r.ok)
console.log('')
if (failed.length === 0) {
  console.log(`=== VŠECHNY MODULY OK (${results.length}/${results.length}) ===`)
  process.exit(0)
}
console.log(`=== SELHALO ${failed.length}/${results.length} ===`)
for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`)
process.exit(1)

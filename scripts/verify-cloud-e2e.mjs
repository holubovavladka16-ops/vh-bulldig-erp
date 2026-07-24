/**
 * End-to-end ověření Supabase Cloud (produkční backend).
 * Spusťte: npm run verify-cloud-e2e
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

async function login() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (error || !data.session || !data.user) throw new Error(error?.message ?? 'Chybí session')
  return { token: data.session.access_token, userId: data.user.id }
}

console.log('=== E2E TEST SUPABASE CLOUD ===\n')

let token
let userId
try {
  const loginResult = await login()
  token = loginResult.token
  userId = loginResult.userId
  pass('Přihlášení administrátora')
} catch (err) {
  fail('Přihlášení administrátora', err.message)
  process.exit(1)
}

const authHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function rest(method, path, body, extra = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { ...authHeaders, ...extra },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { ok: res.ok, status: res.status, data, headers: res.headers }
}

async function rpc(fn, params = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(params),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

// Profil administrátora
const profileRes = await rest('GET', `profiles?id=eq.${userId}&select=role,full_name`)
const profile = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data
if (profileRes.ok && profile?.role === 'administrator') {
  pass('Profil administrátora')
} else {
  fail('Profil administrátora', JSON.stringify(profileRes.data))
}

// Zaměstnanec CRUD
let workerId
const createWorker = await rest('POST', 'workers', {
  first_name: 'E2E',
  last_name: 'Cloud',
  address: 'Test 1',
  birth_date: '1990-05-15',
  start_date: '2024-01-01',
  employment_type: 'HPP',
  position: 'Dělník',
  assigned_order: '',
})
if (createWorker.ok) {
  workerId = createWorker.data.id
  pass('Vytvoření zaměstnance')
} else {
  fail('Vytvoření zaměstnance', JSON.stringify(createWorker.data))
}

// Zakázka
let orderId
const createOrder = await rest('POST', 'job_orders', {
  name: 'E2E Cloud Zakázka',
  location: 'Praha',
  work_description: 'Test',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  status: 'aktivni',
})
if (createOrder.ok) {
  orderId = createOrder.data.id
  pass('Vytvoření zakázky')
} else {
  fail('Vytvoření zakázky', JSON.stringify(createOrder.data))
}

// Nastavení společnosti
const settings = await rest('GET', 'company_settings?select=*&limit=1')
settings.ok ? pass('Nastavení společnosti') : fail('Nastavení společnosti', JSON.stringify(settings.data))

// RPC bootstrap
const bootstrap = await rpc('system_needs_bootstrap')
bootstrap.ok && bootstrap.data === false
  ? pass('Bootstrap dokončen')
  : fail('Bootstrap dokončen', JSON.stringify(bootstrap.data))

// Přehled zisku
const profit = await rpc('get_profit_overview', {
  p_order_id: orderId ?? null,
  p_date_from: '2026-01-01',
  p_date_to: '2026-12-31',
})
profit.ok && Array.isArray(profit.data)
  ? pass('Přehled hospodaření (RPC)')
  : fail('Přehled hospodaření (RPC)', JSON.stringify(profit.data))

// Cleanup
if (workerId) await rest('DELETE', `workers?id=eq.${workerId}`)
if (orderId) await rest('DELETE', `job_orders?id=eq.${orderId}`)

await supabase.auth.signOut()

console.log('')
const failed = results.filter((r) => !r.ok)
if (failed.length === 0) {
  console.log(`=== VŠECHNO OK (${results.length} testů) ===`)
  process.exit(0)
}

console.log(`=== SELHALO ${failed.length}/${results.length} testů ===`)
for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`)
process.exit(1)

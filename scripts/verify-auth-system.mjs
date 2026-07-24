/**
 * Kompletní ověření autentizace, databáze, rolí a RLS proti Supabase Cloud.
 * Spusťte: npm run verify-auth-system
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

const results = []
function pass(name) {
  results.push({ name, ok: true })
  console.log(`  OK  ${name}`)
}
function fail(name, detail) {
  results.push({ name, ok: false, detail })
  console.error(`  FAIL ${name}: ${detail}`)
}

console.log('=== AUTH SYSTEM VERIFICATION ===\n')

// 1. Environment
if (!url || !anonKey) {
  fail('Env: VITE_SUPABASE_URL + ANON_KEY', 'Chybí v .env.local')
  process.exit(1)
}
pass('Env: VITE_SUPABASE_URL + ANON_KEY')

if (!adminEmail || !adminPassword) {
  fail('Env: INITIAL_ADMIN_*', 'Chybí pro test přihlášení')
} else {
  pass('Env: INITIAL_ADMIN_*')
}

// 2. Reachability
try {
  const head = await fetch(`${url}/rest/v1/`, {
    method: 'HEAD',
    headers: { apikey: anonKey },
  })
  if (head.ok || head.status === 404 || head.status === 401) pass('Supabase: dostupnost API')
  else fail('Supabase: dostupnost API', String(head.status))
} catch (err) {
  fail('Supabase: dostupnost API', err.message)
}

const supabase = createClient(url, anonKey)

// 3. Migrations / bootstrap RPC
const bootstrapRpc = await supabase.rpc('system_needs_bootstrap')
if (bootstrapRpc.error) {
  fail('Migrace: system_needs_bootstrap', bootstrapRpc.error.message)
} else if (bootstrapRpc.data === true) {
  fail('Administrátor existuje', 'Bootstrap stále potřebný (system_needs_bootstrap=true)')
} else {
  pass('Migrace: system_needs_bootstrap')
  pass('Administrátor existuje')
}

// 4. Core tables (anon – schema check)
const tables = ['profiles', 'workers', 'job_orders', 'company_settings']
for (const table of tables) {
  const { error } = await supabase.from(table).select('*').limit(0)
  if (error && (error.code === 'PGRST205' || error.message.includes('schema cache'))) {
    fail(`Tabulka: ${table}`, error.message)
  } else {
    pass(`Tabulka: ${table}`)
  }
}

// 5. RLS – anon by neměl číst workers data bez auth
const anonWorkers = await supabase.from('workers').select('id').limit(5)
if (anonWorkers.data?.length) {
  fail('RLS: workers bez přihlášení', 'Anon klíč vidí data – zkontrolujte RLS')
} else {
  pass('RLS: workers bez přihlášení')
}

// 6. Login
const login = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
if (login.error) {
  fail('Přihlášení', login.error.message)
  printSummary()
  process.exit(1)
}
pass('Přihlášení')

const userId = login.data.user.id
const token = login.data.session.access_token

// 7. Profile + role
const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}&select=role,is_active`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
})
const profiles = await profileRes.json()
const profile = Array.isArray(profiles) ? profiles[0] : profiles
if (profile?.role === 'administrator' && profile?.is_active) {
  pass('Profil: role administrator')
} else {
  fail('Profil: role administrator', JSON.stringify(profile))
}

// 8. Authenticated API
const workerCreate = await fetch(`${url}/rest/v1/workers`, {
  method: 'POST',
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({
    first_name: 'AuthTest',
    last_name: 'User',
    address: 'Test',
    birth_date: '1990-01-01',
    start_date: '2024-01-01',
    employment_type: 'HPP',
    position: 'Test',
    assigned_order: '',
  }),
})
const workerData = await workerCreate.json()
const worker = Array.isArray(workerData) ? workerData[0] : workerData
if (workerCreate.ok && worker?.id) {
  pass('API: vytvoření zaměstnance')
  await fetch(`${url}/rest/v1/workers?id=eq.${worker.id}`, {
    method: 'DELETE',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  })
} else {
  fail('API: vytvoření zaměstnance', JSON.stringify(workerData))
}

// 9. Session refresh
const refreshed = await supabase.auth.refreshSession()
if (refreshed.error) fail('Obnova relace', refreshed.error.message)
else pass('Obnova relace')

// 10. Logout
const logout = await supabase.auth.signOut()
if (logout.error) fail('Odhlášení', logout.error.message)
else pass('Odhlášení')

// 11. Post-logout RLS
const afterLogout = await supabase.from('workers').select('id').limit(1)
if (afterLogout.data?.length) fail('RLS po odhlášení', 'Data stále viditelná')
else pass('RLS po odhlášení')

function printSummary() {
  console.log('')
  const failed = results.filter((r) => !r.ok)
  if (failed.length === 0) {
    console.log(`=== VŠECHNO OK (${results.length} testů) ===`)
    return
  }
  console.log(`=== SELHALO ${failed.length}/${results.length} testů ===`)
  for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`)
}

printSummary()
process.exit(results.some((r) => !r.ok) ? 1 : 0)

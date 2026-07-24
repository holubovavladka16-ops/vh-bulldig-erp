/**
 * Ověření data narození – parsování, ukládání do DB a načtení bez posunu.
 * Spusťte: npm run verify-birth-date
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

function parseDateParts(value) {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3] }
  const cz = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (cz) return { year: +cz[3], month: +cz[2], day: +cz[1] }
  return null
}

function formatDateCz(value) {
  const parts = parseDateParts(value)
  if (!parts) return ''
  return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${parts.year}`
}

function toIso(value) {
  const parts = parseDateParts(value)
  if (!parts) return ''
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

const unitTests = [
  ['1990-05-15', '15.05.1990'],
  ['1990-05-15T00:00:00.000Z', '15.05.1990'],
  ['15.05.1990', '1990-05-15'],
  ['01.01.2000', '2000-01-01'],
]

console.log('=== UNIT: parsování data narození ===\n')
let unitOk = true
for (const [input, expected] of unitTests) {
  const asDisplay = formatDateCz(input)
  const asIso = toIso(input.includes('.') ? input : input)
  const ok =
    (expected.includes('.') && asDisplay === expected) ||
    (expected.includes('-') && toIso(input) === expected) ||
    (input.includes('T') && asDisplay === expected)
  if (!ok) {
    unitOk = false
    console.error(`  FAIL ${input} → display=${asDisplay}, iso=${asIso}, expected=${expected}`)
  } else {
    console.log(`  OK  ${input} → ${expected.includes('.') ? asDisplay : toIso(input)}`)
  }
}

if (!url || !anonKey || !adminEmail || !adminPassword) {
  console.log('\n(Přeskočeno API – chybí .env.local)')
  process.exit(unitOk ? 0 : 1)
}

const supabase = createClient(url, anonKey)
const login = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
if (login.error) {
  console.error('Login failed:', login.error.message)
  process.exit(1)
}

const token = login.data.session.access_token
const testBirth = '1988-03-22'
const expectedDisplay = '22.03.1988'

console.log('\n=== API: uložení a načtení birth_date ===\n')

const createRes = await fetch(`${url}/rest/v1/workers`, {
  method: 'POST',
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({
    first_name: 'BirthDate',
    last_name: 'Test',
    address: 'Test 1',
    birth_date: testBirth,
    start_date: '2024-01-01',
    employment_type: 'HPP',
    position: 'Test',
    assigned_order: '',
  }),
})

const created = await createRes.json()
const worker = Array.isArray(created) ? created[0] : created
if (!createRes.ok || !worker?.id) {
  console.error('  FAIL vytvoření:', JSON.stringify(created))
  process.exit(1)
}
console.log(`  OK  vytvořeno birth_date=${worker.birth_date}`)

const updateRes = await fetch(`${url}/rest/v1/workers?id=eq.${worker.id}`, {
  method: 'PATCH',
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ birth_date: '1975-12-01' }),
})
const updated = await updateRes.json()
const row = Array.isArray(updated) ? updated[0] : updated

if (!updateRes.ok || row.birth_date !== '1975-12-01') {
  console.error('  FAIL update:', JSON.stringify(updated))
  process.exit(1)
}
console.log(`  OK  update birth_date=${row.birth_date}`)

const display = formatDateCz(row.birth_date)
if (display !== '01.12.1975') {
  console.error(`  FAIL zobrazení: ${display} (očekáváno 01.12.1975)`)
  process.exit(1)
}
console.log(`  OK  zobrazení ${display}`)

await fetch(`${url}/rest/v1/workers?id=eq.${worker.id}`, {
  method: 'DELETE',
  headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
})

console.log('\n=== VŠECHNO OK ===')
process.exit(unitOk ? 0 : 1)

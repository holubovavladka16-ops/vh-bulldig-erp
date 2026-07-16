/**
 * E2E test ručního zápisu docházky s výkony z ceníku.
 * Spusťte: npm run verify-admin-attendance
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
const cleanup = []

function pass(name) {
  results.push({ name, ok: true })
  console.log(`  OK  ${name}`)
}

function fail(name, detail) {
  results.push({ name, ok: false, detail })
  console.error(`  FAIL ${name}: ${detail}`)
}

let token
let userId

async function login() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (error || !data.session || !data.user) throw new Error(error?.message ?? 'Chybí session')
  token = data.session.access_token
  userId = data.user.id
}

const authHeaders = () => ({
  apikey: anonKey,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

async function rest(method, path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { ok: res.ok, status: res.status, data }
}

async function rpc(fn, params = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

console.log('=== TEST RUČNÍ DOCHÁZKY – VÝKONY Z CENÍKU ===\n')

try {
  await login()
  pass('Přihlášení administrátora')
} catch (err) {
  fail('Přihlášení administrátora', err.message)
  process.exit(1)
}

const today = new Date().toISOString().split('T')[0]
let workerId
let orderId
let priceItemId
let attendanceId

const workerRes = await rest('POST', 'workers', {
  first_name: 'Docházka',
  last_name: 'Admin',
  address: 'Test 1',
  birth_date: '1990-01-01',
  start_date: '2024-01-01',
  employment_type: 'HPP',
  position: 'Dělník',
  assigned_order: '',
})
const workerPayload = Array.isArray(workerRes.data) ? workerRes.data[0] : workerRes.data
workerId = workerPayload?.id
if (!workerRes.ok || !workerId) {
  fail('Vytvoření testovacího dělníka', JSON.stringify(workerRes.data))
  process.exit(1)
}
cleanup.push(async () => rest('DELETE', `workers?id=eq.${workerId}`))
pass('Vytvoření testovacího dělníka')

const orderRes = await rest('POST', 'job_orders', {
  name: `E2E Docházka ${Date.now()}`,
  location: 'Praha',
  work_description: 'Test',
  start_date: today,
  end_date: '2026-12-31',
  status: 'aktivni',
})
const orderPayload = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
orderId = orderPayload?.id
if (!orderRes.ok || !orderId) {
  fail('Vytvoření zakázky', JSON.stringify(orderRes.data))
} else {
  cleanup.push(async () => rest('DELETE', `job_orders?id=eq.${orderId}`))
  pass('Vytvoření zakázky')
}

const priceRes = await rest('POST', 'worker_price_items', {
  worker_id: workerId,
  name: 'Výkop metr',
  unit_type: 'metr',
  price: 200,
  is_default: false,
  is_active: true,
  sort_order: 2,
})
const pricePayload = Array.isArray(priceRes.data) ? priceRes.data[0] : priceRes.data
priceItemId = pricePayload?.id
if (!priceRes.ok || !priceItemId) {
  fail('Položka ceníku', JSON.stringify(priceRes.data))
} else {
  pass('Položka ceníku (200 Kč/m)')
}

const ceník = await rest('GET', `worker_price_items?worker_id=eq.${workerId}&select=id,name,price,is_active`)
const activeItems = (ceník.data ?? []).filter((p) => p.name !== 'Hodinová sazba' && p.is_active !== false)
if (ceník.ok && activeItems.some((p) => Number(p.price) === 200)) {
  pass('Ceník zaměstnance načten s cenou')
} else {
  fail('Ceník zaměstnance', JSON.stringify(ceník.data))
}

const upsert = await rpc('admin_upsert_attendance', {
  p_worker_id: workerId,
  p_attendance_date: today,
  p_order_id: orderId,
  p_advance: 100,
  p_note: 'E2E admin docházka',
  p_task_items: [{ price_item_id: priceItemId, quantity: 5 }],
  p_work_start: '07:00',
  p_work_end: '15:00',
  p_break_minutes: 30,
  p_id: null,
  p_performed_by: userId,
  p_status: 'pritomen',
})

if (!upsert.ok) {
  fail('admin_upsert_attendance RPC', JSON.stringify(upsert.data))
} else {
  attendanceId = upsert.data
  pass('admin_upsert_attendance uložení')
}

if (attendanceId) {
  const att = await rest('GET', `worker_attendance_records?id=eq.${attendanceId}&select=hours,daily_advance,form_id`)
  const row = att.data?.[0]
  const formId = row?.form_id
  if (att.ok && row?.daily_advance == 100) {
    pass('Zápis v docházce')
  } else {
    fail('Zápis v docházce', JSON.stringify(att.data))
  }

  if (formId) {
    const tasks = await rest('GET', `worker_form_task_items?form_id=eq.${formId}&select=quantity,line_earnings`)
    const task = tasks.data?.[0]
    const expected = 5 * 200
    if (tasks.ok && task?.quantity == 5 && Number(task.line_earnings) === expected) {
      pass(`Výkon uložen (${expected} Kč)`)
    } else {
      fail('Výkon v task_items', JSON.stringify(tasks.data))
    }

    const report = await rest('GET', `worker_reports?form_id=eq.${formId}&select=earnings,status`)
    if (report.ok && Number(report.data?.[0]?.earnings) >= expected) {
      pass('Výkaz zaměstnance')
    } else {
      fail('Výkaz zaměstnance', JSON.stringify(report.data))
    }
  }
}

for (const fn of cleanup.reverse()) {
  await fn().catch(() => {})
}

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

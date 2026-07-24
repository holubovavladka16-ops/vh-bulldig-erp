/**
 * E2E test formuláře dělníka – výkony z ceníku → docházka → výkazy.
 * Spusťte: npm run verify-portal-performance
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

async function login() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (error || !data.session) throw new Error(error?.message ?? 'Chybí session')
  return data.session.access_token
}

const authHeaders = () => ({
  apikey: anonKey,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
})

let token

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

async function rpc(fn, params = {}, useAnon = false) {
  const headers = useAnon
    ? { apikey: anonKey, 'Content-Type': 'application/json' }
    : authHeaders()
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

console.log('=== TEST FORMULÁŘE DĚLNÍKA – VÝKONY ===\n')

try {
  token = await login()
  pass('Přihlášení administrátora')
} catch (err) {
  fail('Přihlášení administrátora', err.message)
  process.exit(1)
}

const today = new Date().toISOString().split('T')[0]
let workerId
let orderId
let portalToken
let formId
let priceItemId

const workerRes = await rest('POST', 'workers', {
  first_name: 'Výkon',
  last_name: 'Test',
  address: 'Test 1',
  birth_date: '1990-01-01',
  start_date: '2024-01-01',
  employment_type: 'HPP',
  position: 'Dělník',
  assigned_order: '',
})
if (!workerRes.ok) {
  fail('Vytvoření testovacího dělníka', JSON.stringify(workerRes.data))
  process.exit(1)
}
const workerPayload = Array.isArray(workerRes.data) ? workerRes.data[0] : workerRes.data
workerId = workerPayload?.id
if (!workerId) {
  fail('ID testovacího dělníka', JSON.stringify(workerRes.data))
  process.exit(1)
}
cleanup.push(async () => rest('DELETE', `workers?id=eq.${workerId}`))
pass('Vytvoření testovacího dělníka')

const workerRow = await rest('GET', `workers?id=eq.${workerId}&select=portal_token`)
portalToken = workerRow.data?.[0]?.portal_token
if (!portalToken) {
  fail('Portal token dělníka', 'Chybí portal_token')
} else {
  pass('Portal token dělníka')
}

const orderRes = await rest('POST', 'job_orders', {
  name: `E2E Výkon ${Date.now()}`,
  location: 'Praha',
  work_description: 'Test výkonů',
  start_date: today,
  end_date: '2026-12-31',
  status: 'aktivni',
})
if (!orderRes.ok) {
  fail('Vytvoření aktivní zakázky', JSON.stringify(orderRes.data))
} else {
  const orderPayload = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data
  orderId = orderPayload?.id
  cleanup.push(async () => rest('DELETE', `job_orders?id=eq.${orderId}`))
  pass('Vytvoření aktivní zakázky')
}

const priceRes = await rest('POST', 'worker_price_items', {
  worker_id: workerId,
  name: 'Výkop metr',
  unit_type: 'metr',
  price: 150,
  is_default: false,
  is_active: true,
  sort_order: 2,
})
if (!priceRes.ok) {
  fail('Položka ceníku (metr)', JSON.stringify(priceRes.data))
} else {
  const pricePayload = Array.isArray(priceRes.data) ? priceRes.data[0] : priceRes.data
  priceItemId = pricePayload?.id
  pass('Položka ceníku (metr)')
}

const priceRes2 = await rest('POST', 'worker_price_items', {
  worker_id: workerId,
  name: 'Průraz',
  unit_type: 'kus',
  price: 500,
  is_default: false,
  is_active: true,
  sort_order: 3,
})
const price2Payload = Array.isArray(priceRes2.data) ? priceRes2.data[0] : priceRes2.data
priceRes2.ok ? pass('Druhá položka ceníku (kus)') : fail('Druhá položka ceníku', JSON.stringify(priceRes2.data))

const priceItemsRpc = await rpc('portal_get_price_items', { p_token: portalToken }, true)
const priceItemsList = Array.isArray(priceItemsRpc.data) ? priceItemsRpc.data : []
const taskItems = priceItemsList.filter((p) => p.name !== 'Hodinová sazba')
if (priceItemsRpc.ok && taskItems.length >= 2) {
  pass('Portal načte ceník bez hodinové sazby')
} else {
  fail('Portal načte ceník', JSON.stringify(priceItemsRpc.data))
}

const saveRes = await rpc(
  'portal_save_form',
  {
    p_token: portalToken,
    p_form_id: null,
    p_form_date: today,
    p_order_id: orderId,
    p_work_start: '07:00',
    p_work_end: '15:00',
    p_break_minutes: 30,
    p_advance: 200,
    p_material: '',
    p_note: 'E2E test výkonů',
    p_gps_lat: null,
    p_gps_lng: null,
    p_gps_accuracy: null,
    p_signature_data: 'data:image/png;base64,test',
    p_task_items: [
      { price_item_id: priceItemId, quantity: 12 },
      { price_item_id: price2Payload?.id ?? priceItemId, quantity: 2 },
    ],
  },
  true
)

if (!saveRes.ok) {
  fail('Uložení formuláře s výkony', JSON.stringify(saveRes.data))
} else {
  formId = saveRes.data
  pass('Uložení formuláře s výkony')
}

if (formId) {
  const tasks = await rpc('portal_get_form_task_items', { p_token: portalToken, p_form_id: formId }, true)
  const savedCount = Array.isArray(tasks.data) ? tasks.data.length : 0
  const expectedEarnings = 12 * 150 + 2 * 500
  if (tasks.ok && savedCount === 2) {
    pass('Výkony uloženy (2 položky)')
  } else {
    fail('Výkony uloženy', `očekáváno 2, uloženo ${savedCount}: ${JSON.stringify(tasks.data)}`)
  }

  const formRow = await rest('GET', `worker_daily_forms?id=eq.${formId}&select=earnings,work_type,hours`)
  const earnings = Number(formRow.data?.[0]?.earnings ?? 0)
  const workType = formRow.data?.[0]?.work_type
  if (formRow.ok && earnings === expectedEarnings) {
    pass(`Výpočet výdělku (${expectedEarnings} Kč)`)
  } else {
    fail('Výpočet výdělku', `očekáváno ${expectedEarnings}, skutečnost ${earnings}`)
  }
  if (workType === 'kombinovana') {
    pass('Typ práce kombinovaná (hodiny + výkony)')
  } else {
    fail('Typ práce', `očekáváno kombinovana, skutečnost ${workType}`)
  }

  const submitRes = await rpc('portal_submit_form', { p_token: portalToken, p_form_id: formId }, true)
  submitRes.ok ? pass('Odeslání formuláře') : fail('Odeslání formuláře', JSON.stringify(submitRes.data))

  const report = await rest('GET', `worker_reports?form_id=eq.${formId}&select=earnings,status,order_id`)
  if (report.ok && report.data?.[0]?.earnings == expectedEarnings) {
    pass('Zápis ve výkazu zaměstnance')
  } else {
    fail('Zápis ve výkazu zaměstnance', JSON.stringify(report.data))
  }

  const attendance = await rest(
    'GET',
    `worker_attendance_records?form_id=eq.${formId}&select=hours,order_id,daily_advance,work_start`
  )
  const att = attendance.data?.[0]
  if (attendance.ok && att?.order_id === orderId && Number(att.daily_advance) === 200) {
    pass('Zápis v docházce')
  } else {
    fail('Zápis v docházce', JSON.stringify(attendance.data))
  }

  const orderReport = await rest(
    'GET',
    `worker_reports?order_id=eq.${orderId}&form_id=eq.${formId}&select=id`
  )
  orderReport.ok && orderReport.data?.length > 0
    ? pass('Výkaz zakázky')
    : fail('Výkaz zakázky', JSON.stringify(orderReport.data))
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

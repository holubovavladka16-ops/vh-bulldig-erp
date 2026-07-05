/**
 * End-to-end ověření lokálního ERP stacku.
 * Spusťte: npm run dev:local:stack (jiný terminál), pak npm run verify-e2e
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const ENV_FILE = join(ROOT, '.local-stack/runtime.env.json')

if (!existsSync(ENV_FILE)) {
  console.error('FAIL: Lokální stack neběží. Spusťte: npm run dev:local:stack')
  process.exit(1)
}

const { url, anonKey, adminEmail, adminPassword } = JSON.parse(readFileSync(ENV_FILE, 'utf8'))

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
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description ?? data.message ?? res.status)
  return data.access_token
}

async function rest(token, method, path, body, headers = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      Accept: 'application/vnd.pgrst.object+json',
      ...headers,
    },
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

async function rpc(token, fn, params = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

console.log('=== E2E TEST VH BULLDIG ERP ===\n')

let token
try {
  token = await login()
  pass('Přihlášení administrátora')
} catch (err) {
  fail('Přihlášení administrátora', err.message)
  process.exit(1)
}

// Zaměstnanec CRUD
let workerId
const createWorker = await rest(token, 'POST', 'workers', {
  first_name: 'E2E',
  last_name: 'Test',
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

if (workerId) {
  const updateWorker = await rest(token, 'PATCH', `workers?id=eq.${workerId}`, {
    first_name: 'E2E',
    last_name: 'Upravený',
    address: 'Test 2',
    birth_date: '1990-05-15',
    start_date: '2024-01-01',
    employment_type: 'DPP',
    position: 'Zedník',
    assigned_order: '',
    assigned_order_id: null,
    phone: '777000111',
    email: 'e2e@test.cz',
    birth_number: null,
    nationality: 'CZ',
    note: 'E2E',
  })
  updateWorker.ok ? pass('Úprava zaměstnance') : fail('Úprava zaměstnance', JSON.stringify(updateWorker.data))
}

// Zakázka
let orderId
const createOrder = await rest(token, 'POST', 'job_orders', {
  name: 'E2E Zakázka',
  location: 'Praha',
  work_description: 'Testovací práce',
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

// Embed select – náklady
const costsEmbed = await rest(
  token,
  'GET',
  'job_costs?select=' + encodeURIComponent('*, job_orders(name)'),
  null,
  { Accept: 'application/json', Prefer: '' }
)
if (costsEmbed.ok && (Array.isArray(costsEmbed.data) ? costsEmbed.data[0]?.job_orders : costsEmbed.data?.job_orders)) {
  pass('Embed select (job_costs + job_orders)')
} else {
  fail('Embed select (job_costs + job_orders)', JSON.stringify(costsEmbed.data))
}

// Docházka embed (po odeslání formuláře ověříme znovu na konci)

// Náklad
if (orderId) {
  const createCost = await rest(token, 'POST', 'job_costs', {
    cost_date: '2026-07-01',
    order_id: orderId,
    name: 'E2E materiál',
    price: 1500,
    category: 'material',
  })
  createCost.ok ? pass('Vytvoření nákladu') : fail('Vytvoření nákladu', JSON.stringify(createCost.data))
}

// Fakturace
if (orderId) {
  const createInvoice = await rest(token, 'POST', 'job_order_invoices', {
    order_id: orderId,
    invoice_date: '2026-07-01',
    invoice_number: 'FV-E2E-001',
    amount: 50000,
  })
  createInvoice.ok ? pass('Zadání fakturace') : fail('Zadání fakturace', JSON.stringify(createInvoice.data))
}

// Přehled zisku RPC
const profit = await rpc(token, 'get_profit_overview', {
  p_order_id: orderId ?? null,
  p_date_from: '2026-01-01',
  p_date_to: '2026-12-31',
})
if (profit.ok && Array.isArray(profit.data)) {
  pass('Přehled hospodaření a zisku (RPC)')
} else {
  fail('Přehled hospodaření a zisku (RPC)', JSON.stringify(profit.data))
}

// Denní formulář + výkaz (přes DB insert + submit simulation)
if (workerId && orderId) {
  const formInsert = await rest(token, 'POST', 'worker_daily_forms', {
    worker_id: workerId,
    form_date: '2026-07-05',
    order_id: orderId,
    order_name: 'E2E Zakázka',
    activity: 'Test',
    work_type: 'hodinova',
    work_description: 'E2E test',
    work_start: '07:00:00',
    work_end: '15:00:00',
    break_minutes: 30,
    hours: 7.5,
    meters: 0,
    pieces: 0,
    advance: 500,
    material: '',
    note: 'E2E',
    earnings: 3000,
    status: 'koncept',
    signature_data: 'data:image/png;base64,iVBORw0KGgo=',
  })

  if (formInsert.ok) {
    pass('Vytvoření denního formuláře')
    const formId = formInsert.data.id

    const submit = await rpc(token, 'submit_worker_daily_form', { p_form_id: formId })
    if (submit.ok || submit.data === null) {
      pass('Odeslání formuláře → výkaz + docházka')

      const reports = await rest(
        token,
        'GET',
        `worker_reports?form_id=eq.${formId}&select=*`,
        null,
        { Accept: 'application/json', Prefer: '' }
      )
      if (reports.ok && Array.isArray(reports.data) && reports.data.length > 0) {
        pass('Automatické vytvoření výkazu')
      } else {
        fail('Automatické vytvoření výkazu', JSON.stringify(reports.data))
      }

      const attendance = await rest(
        token,
        'GET',
        `worker_attendance_records?form_id=eq.${formId}&select=*`,
        null,
        { Accept: 'application/json', Prefer: '' }
      )
      if (attendance.ok && Array.isArray(attendance.data) && attendance.data.length > 0) {
        pass('Automatická docházka z formuláře')
      } else {
        fail('Automatická docházka z formuláře', JSON.stringify(attendance.data))
      }

      const attendanceEmbed = await rest(
        token,
        'GET',
        'worker_attendance_records?select=' + encodeURIComponent('*, workers:worker_id(first_name, last_name)') + '&limit=5',
        null,
        { Accept: 'application/json', Prefer: '' }
      )
      const attRows = Array.isArray(attendanceEmbed.data) ? attendanceEmbed.data : attendanceEmbed.data ? [attendanceEmbed.data] : []
      if (attendanceEmbed.ok && attRows.some((r) => r.workers?.first_name)) {
        pass('Embed select (docházka + workers)')
      } else {
        fail('Embed select (docházka + workers)', JSON.stringify(attendanceEmbed.data))
      }
    } else {
      fail('Odeslání formuláře', JSON.stringify(submit.data))
    }
  } else {
    fail('Vytvoření denního formuláře', JSON.stringify(formInsert.data))
  }
}

// Dashboard count HEAD
const countRes = await fetch(`${url}/rest/v1/workers?select=id`, {
  method: 'HEAD',
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    Prefer: 'count=exact',
  },
})
if (countRes.ok && countRes.headers.get('content-range')) {
  pass('Dashboard count (HEAD)')
} else {
  fail('Dashboard count (HEAD)', countRes.status)
}

// Smazání zaměstnance
if (workerId) {
  const del = await rest(token, 'DELETE', `workers?id=eq.${workerId}`)
  del.ok ? pass('Smazání zaměstnance') : fail('Smazání zaměstnance', JSON.stringify(del.data))
}

if (orderId) {
  await rest(token, 'DELETE', `job_orders?id=eq.${orderId}`)
}

console.log('')
const failed = results.filter((r) => !r.ok)
if (failed.length === 0) {
  console.log(`=== VŠECHNO OK (${results.length} testů) ===`)
  process.exit(0)
}

console.log(`=== SELHALO ${failed.length}/${results.length} testů ===`)
for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`)
process.exit(1)

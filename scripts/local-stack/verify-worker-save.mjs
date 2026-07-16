/**
 * Ověří vytvoření a úpravu zaměstnance přes lokální REST API.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const ENV_FILE = join(ROOT, '.local-stack/runtime.env.json')

if (!existsSync(ENV_FILE)) {
  console.error('FAIL: Lokální stack neběží (.local-stack/runtime.env.json chybí)')
  process.exit(1)
}

const { url, anonKey, adminEmail, adminPassword } = JSON.parse(readFileSync(ENV_FILE, 'utf8'))

async function login() {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Login: ${data.error_description ?? data.message ?? res.status}`)
  return data.access_token
}

async function rest(token, method, path, body) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    Accept: 'application/vnd.pgrst.object+json',
  }
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
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

const token = await login()
console.log('Login OK')

const create = await rest(token, 'POST', 'workers', {
  first_name: 'Test',
  last_name: 'Ukládání',
  address: 'Testovací 1, Praha',
  birth_date: '1990-01-01',
  start_date: '2024-01-01',
  employment_type: 'HPP',
  position: 'Dělník',
  assigned_order: '',
})
console.log('CREATE:', create.status, create.ok ? 'OK' : create.data)

if (!create.ok) {
  console.error('Příčina CREATE:', JSON.stringify(create.data, null, 2))
  process.exit(1)
}

const workerId = create.data.id

const update = await rest(token, 'PATCH', `workers?id=eq.${workerId}`, {
  first_name: 'Test',
  last_name: 'Upravený',
  address: 'Nová adresa 2',
  birth_date: '1990-01-01',
  start_date: '2024-01-01',
  employment_type: 'DPP',
  position: 'Zedník',
  assigned_order: 'Zakázka A',
  assigned_order_id: null,
  phone: '777123456',
  email: 'test@example.cz',
  birth_number: null,
  nationality: 'CZ',
  note: 'Poznámka test',
})
console.log('UPDATE:', update.status, update.ok ? 'OK' : update.data)

if (!update.ok) {
  console.error('Příčina UPDATE:', JSON.stringify(update.data, null, 2))
  process.exit(1)
}

const del = await rest(token, 'DELETE', `workers?id=eq.${workerId}`)
console.log('DELETE:', del.status, del.ok ? 'OK' : del.data)

if (!del.ok) {
  console.error('Příčina DELETE:', JSON.stringify(del.data, null, 2))
  process.exit(1)
}

console.log('OK: Všechny operace se zaměstnancem fungují')

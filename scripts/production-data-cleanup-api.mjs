/**
 * Vyčištění produkčních dat přes Supabase REST API (admin session).
 * Používá se, když není k dispozici SUPABASE_DB_PASSWORD.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
    if (!process.env[key]?.trim()) process.env[key] = value
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')
loadEnvFile('.env.production')

const args = new Set(process.argv.slice(2))
const isAudit = args.has('--audit')
const isExecute = args.has('--execute')
const withSmokeTest = args.has('--smoke-test')

if (!isAudit && !isExecute) {
  console.error('Použití: --audit | --execute [--smoke-test]')
  process.exit(1)
}

if (isExecute && process.env.PRODUCTION_CLEANUP_CONFIRM !== 'YES') {
  console.error('FAIL: Nastavte PRODUCTION_CLEANUP_CONFIRM=YES')
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const adminEmail = process.env.CLEANUP_ADMIN_EMAIL ?? process.env.INITIAL_ADMIN_EMAIL ?? 'test@vhbulldig.cz'
const adminPassword = process.env.CLEANUP_ADMIN_PASSWORD ?? process.env.INITIAL_ADMIN_PASSWORD ?? 'Test123456'

if (!url || !anonKey) {
  console.error('FAIL: Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const CONTENT_TABLES = [
  'paper_monthly_import_log',
  'paper_monthly_form_lines',
  'paper_monthly_forms',
  'worker_form_task_items',
  'worker_form_photos',
  'worker_reports',
  'worker_attendance_records',
  'worker_history',
  'worker_statistics',
  'worker_daily_forms',
  'worker_documents',
  'worker_price_items',
  'receipts',
  'utility_connections',
  'construction_diary_entries',
  'gps_photo_history',
  'gps_photos',
  'construction_point_history',
  'construction_point_notes',
  'construction_points',
  'job_cost_photos',
  'job_cost_documents',
  'job_costs',
  'job_order_invoices',
  'job_order_photos',
  'job_order_documents',
  'excavation_routes',
  'workers',
  'job_orders',
  // login_logs: pouze service_role (RLS) – viz OPTIONAL_TABLES
  'attendance',
  'payroll',
  'invoices',
  'orders',
  'projects',
  'employees',
  'warehouse_items',
  'warehouses',
  'documents',
  'vehicles',
  'reports',
]

/** Tabulky, které nelze smazat přes REST (vyžadují service_role). */
const SERVICE_ROLE_ONLY_TABLES = ['login_logs']

const STORAGE_SOURCES = [
  { table: 'worker_documents', column: 'file_path', bucket: 'worker-documents' },
  { table: 'worker_form_photos', column: 'file_path', bucket: 'worker-photos' },
  { table: 'job_order_documents', column: 'file_path', bucket: 'order-documents' },
  { table: 'job_order_photos', column: 'file_path', bucket: 'order-photos' },
  { table: 'gps_photos', column: 'file_path', bucket: 'gps-photos' },
  { table: 'job_cost_photos', column: 'file_path', bucket: 'cost-photos' },
  { table: 'job_cost_documents', column: 'file_path', bucket: 'cost-documents' },
  { table: 'receipts', column: 'photo_path', bucket: 'receipt-photos' },
  { table: 'paper_monthly_forms', column: 'blank_pdf_path', bucket: 'paper-forms' },
  { table: 'paper_monthly_forms', column: 'scanned_photo_path', bucket: 'paper-forms' },
  { table: 'paper_monthly_forms', column: 'signed_pdf_path', bucket: 'paper-forms' },
]

const supabase = createClient(url, anonKey)

async function login() {
  const { error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
  if (error) throw new Error(`Přihlášení (${adminEmail}): ${error.message}`)
}

async function countTable(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error?.code === '42P01' || error?.message?.includes('does not exist')) return null
  if (error) return { error: error.message }
  return count ?? 0
}

async function audit() {
  const counts = {}
  for (const table of CONTENT_TABLES) {
    counts[table] = await countTable(table)
  }
  const { data: profiles } = await supabase.from('profiles').select('id,email,role,is_active')
  const { data: company } = await supabase.from('company_settings').select('company_name').limit(1)
  return { counts, profiles, company }
}

function printAudit(auditData) {
  console.log('\n=== AUDIT (REST API) ===\n')
  let total = 0
  for (const [table, count] of Object.entries(auditData.counts)) {
    if (count === null || typeof count === 'object') continue
    if (count > 0) console.log(`  ${table}: ${count}`)
    total += count
  }
  console.log(`\nCelkem řádků: ${total}`)
  console.log('\nProfily:')
  for (const p of auditData.profiles ?? []) {
    console.log(`  ${p.email} role=${p.role} active=${p.is_active}`)
  }
  console.log('\nFirma:', auditData.company?.[0]?.company_name ?? '—')
}

async function collectStoragePaths() {
  const paths = []
  for (const src of STORAGE_SOURCES) {
    const { data, error } = await supabase.from(src.table).select(src.column)
    if (error) continue
    for (const row of data ?? []) {
      const path = row[src.column]
      if (path) paths.push({ bucket: src.bucket, path })
    }
  }
  return paths
}

async function deleteStoragePaths(paths) {
  const byBucket = new Map()
  for (const { bucket, path } of paths) {
    const list = byBucket.get(bucket) ?? []
    list.push(path)
    byBucket.set(bucket, list)
  }
  let deleted = 0
  for (const [bucket, files] of byBucket) {
    const unique = [...new Set(files)]
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100)
      const { error } = await supabase.storage.from(bucket).remove(chunk)
      if (error) console.warn(`  storage/${bucket}: ${error.message}`)
      else deleted += chunk.length
    }
  }
  return deleted
}

async function deleteAllFromTable(table) {
  const count = await countTable(table)
  if (!count || typeof count === 'object') return 0
  const { error } = await supabase.from(table).delete().gte('created_at', '1970-01-01')
  if (error) {
    const { error: err2 } = await supabase.from(table).delete().not('id', 'is', null)
    if (err2) throw new Error(`${table}: ${err2.message}`)
  }
  return count
}

async function executeCleanup() {
  const storagePaths = await collectStoragePaths()
  console.log(`\nStorage souborů k odstranění: ${storagePaths.length}`)
  if (storagePaths.length > 0) {
    const removed = await deleteStoragePaths(storagePaths)
    console.log(`  smazáno storage: ${removed} souborů`)
  }

  console.log('\nMazání tabulek:')
  const deleted = {}
  for (const table of CONTENT_TABLES) {
    try {
      const n = await deleteAllFromTable(table)
      if (n > 0) {
        deleted[table] = n
        console.log(`  ${table}: ${n}`)
      }
    } catch (e) {
      console.warn(`  ${table}: přeskočeno (${e.message})`)
    }
  }
  return deleted
}

async function smokeTest() {
  const { data: worker, error: wErr } = await supabase
    .from('workers')
    .insert({
      first_name: 'Smoke',
      last_name: 'Test',
      address: 'Audit 1',
      birth_date: '1990-01-01',
      start_date: '2026-01-01',
      employment_type: 'HPP',
      position: 'Dělník',
    })
    .select('id')
    .single()
  if (wErr) throw new Error(wErr.message)

  const { data: order, error: oErr } = await supabase
    .from('job_orders')
    .insert({
      name: 'Smoke Test Zakázka',
      location: 'Praha',
      work_description: 'Audit',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'aktivni',
    })
    .select('id')
    .single()
  if (oErr) throw new Error(oErr.message)

  const { data: formId, error: fErr } = await supabase.rpc('create_paper_monthly_form', {
    p_month: 7,
    p_year: 2026,
    p_supervisor_id: null,
  })
  if (fErr) throw new Error(fErr.message)

  const { data: formRow } = await supabase
    .from('paper_monthly_forms')
    .select('form_number')
    .eq('id', formId)
    .single()
  if (formRow?.form_number !== 'PM-2026-00001') {
    throw new Error(`Čítač: očekáváno PM-2026-00001, dostáno ${formRow?.form_number}`)
  }

  await supabase.from('paper_monthly_forms').delete().eq('id', formId)
  await supabase.from('workers').delete().eq('id', worker.id)
  await supabase.from('job_orders').delete().eq('id', order.id)
  return true
}

console.log('=== Vyčištění přes REST API ===')
console.log(`Admin: ${adminEmail}`)

await login()
const auditData = await audit()
printAudit(auditData)

if (isAudit) {
  await supabase.auth.signOut()
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = resolve(process.cwd(), 'backups', `api-cleanup-${stamp}`)
mkdirSync(backupDir, { recursive: true })
writeFileSync(resolve(backupDir, 'pre-cleanup-audit.json'), JSON.stringify(auditData, null, 2))
console.log(`\nZáloha: ${backupDir}`)

const deleted = await executeCleanup()
writeFileSync(resolve(backupDir, 'deleted.json'), JSON.stringify(deleted, null, 2))

const postAudit = await audit()
printAudit(postAudit)

let totalRemaining = 0
const skipped = []
for (const [table, count] of Object.entries(postAudit.counts)) {
  if (typeof count !== 'number' || count === 0) continue
  if (SERVICE_ROLE_ONLY_TABLES.includes(table)) {
    skipped.push(`${table}: ${count} (vyžaduje service_role)`)
    continue
  }
  totalRemaining += count
}
if (skipped.length > 0) {
  console.log('\nPřeskočeno (RLS / service_role):')
  for (const s of skipped) console.log(`  ${s}`)
}
if (totalRemaining > 0) {
  console.error(`\nFAIL: Zbývá ${totalRemaining} řádků`)
  process.exit(1)
}

if (withSmokeTest) {
  console.log('\n=== SMOKE TEST ===')
  await smokeTest()
  console.log('  OK: zaměstnanec, zakázka, formulář PM-2026-00001, cleanup')
}

await supabase.auth.signOut()
console.log('\n=== HOTOVO ===')

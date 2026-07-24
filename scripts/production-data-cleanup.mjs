/**
 * Produkční vyčištění testovacích a obsahových dat VH Bulldig ERP.
 *
 * Zachovává: schéma DB, migrace, role, administrátory, company_settings,
 * erp_modules, storage buckety, logo (company-logos / company-assets).
 *
 * Spuštění:
 *   node scripts/production-data-cleanup.mjs --audit
 *   node scripts/production-data-cleanup.mjs --execute
 *   node scripts/production-data-cleanup.mjs --execute --smoke-test
 *
 * Vyžaduje SUPABASE_DB_PASSWORD nebo SUPABASE_DB_URL v prostředí.
 * Pro smoke test navíc INITIAL_ADMIN_EMAIL a INITIAL_ADMIN_PASSWORD.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { connectSupabaseDb, getProjectRef } from './supabase-db-client.mjs'

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

const args = new Set(process.argv.slice(2))
const isAudit = args.has('--audit')
const isExecute = args.has('--execute')
const withSmokeTest = args.has('--smoke-test')

if (!isAudit && !isExecute) {
  console.error('Použití: --audit | --execute [--smoke-test]')
  process.exit(1)
}

if (isExecute && process.env.PRODUCTION_CLEANUP_CONFIRM !== 'YES') {
  console.error('FAIL: Pro mazání nastavte PRODUCTION_CLEANUP_CONFIRM=YES')
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL
const dbPassword = process.env.SUPABASE_DB_PASSWORD
const projectRef = getProjectRef(url)

if (!url || !projectRef || !dbPassword) {
  console.error('FAIL: Chybí VITE_SUPABASE_URL nebo SUPABASE_DB_PASSWORD')
  process.exit(1)
}

/** Tabulky s obsahovými daty – budou vyčištěny (TRUNCATE/DELETE). */
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
  'login_logs',
  // legacy schéma z 001_initial_schema
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

/** Tabulky a objekty, které se NIKDY nemažou. */
const PRESERVE_TABLES = [
  'profiles',
  'company_settings',
  'app_settings',
  'erp_modules',
  'auth.users',
  'auth.identities',
  'storage.buckets',
]

const STORAGE_BUCKETS_TO_CLEAN = [
  'worker-documents',
  'worker-photos',
  'gps-photos',
  'order-photos',
  'order-documents',
  'cost-photos',
  'cost-documents',
  'receipt-photos',
  'paper-forms',
]

const STORAGE_BUCKETS_PRESERVE = ['company-logos', 'company-assets']

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [`public.${tableName}`]
  )
  return rows[0]?.exists === true
}

async function countTable(client, tableName) {
  if (!(await tableExists(client, tableName))) return null
  const { rows } = await client.query(`SELECT COUNT(*)::int AS c FROM public.${tableName}`)
  return rows[0].c
}

async function auditDatabase(client) {
  const counts = {}
  for (const table of CONTENT_TABLES) {
    counts[table] = await countTable(client, table)
  }

  const preserve = {}
  for (const key of ['profiles', 'company_settings', 'app_settings', 'erp_modules']) {
    preserve[key] = await countTable(client, key)
  }

  const { rows: adminRows } = await client.query(
    `SELECT id, email, role, is_active FROM profiles WHERE role = 'administrator' ORDER BY created_at`
  )

  const { rows: nonAdminUsers } = await client.query(
    `SELECT id, email, role FROM profiles WHERE role IS DISTINCT FROM 'administrator' ORDER BY email`
  )

  return { counts, preserve, administrators: adminRows, nonAdminUsers }
}

async function auditStorage(client) {
  const buckets = {}
  for (const bucket of [...STORAGE_BUCKETS_TO_CLEAN, ...STORAGE_BUCKETS_PRESERVE]) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS c, COALESCE(SUM((metadata->>'size')::bigint), 0)::bigint AS bytes
       FROM storage.objects WHERE bucket_id = $1`,
      [bucket]
    )
    buckets[bucket] = {
      objects: rows[0]?.c ?? 0,
      bytes: Number(rows[0]?.bytes ?? 0),
    }
  }
  return buckets
}

function printAuditReport(dbAudit, storageAudit) {
  console.log('\n=== AUDIT DATABÁZE ===\n')
  console.log('Obsahové tabulky k odstranění:')
  let totalRows = 0
  for (const [table, count] of Object.entries(dbAudit.counts)) {
    if (count === null) continue
    if (count > 0) console.log(`  ${table}: ${count}`)
    totalRows += count ?? 0
  }
  if (totalRows === 0) console.log('  (všechny prázdné)')
  console.log(`\nCelkem řádků k odstranění: ${totalRows}`)

  console.log('\nZachované tabulky:')
  for (const [table, count] of Object.entries(dbAudit.preserve)) {
    console.log(`  ${table}: ${count ?? '—'}`)
  }

  console.log('\nAdministrátoři (zachováni):')
  for (const admin of dbAudit.administrators) {
    console.log(`  ${admin.email} (${admin.id}) active=${admin.is_active}`)
  }
  if (dbAudit.administrators.length === 0) {
    console.error('  VAROVÁNÍ: žádný administrátor!')
  }

  if (dbAudit.nonAdminUsers.length > 0) {
    console.log('\nNe-admin uživatelé (budou odstraněni z auth):')
    for (const u of dbAudit.nonAdminUsers) {
      console.log(`  ${u.email} role=${u.role}`)
    }
  }

  console.log('\n=== AUDIT STORAGE ===\n')
  for (const [bucket, info] of Object.entries(storageAudit)) {
    const action = STORAGE_BUCKETS_TO_CLEAN.includes(bucket) ? 'SMAZAT' : 'ZACHOVAT'
    console.log(`  [${action}] ${bucket}: ${info.objects} souborů (${info.bytes} B)`)
  }
}

async function saveBackup(client, dbAudit, storageAudit) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = resolve(process.cwd(), 'backups', `production-cleanup-${stamp}`)
  mkdirSync(dir, { recursive: true })

  const sample = {}
  for (const table of CONTENT_TABLES) {
    if (!dbAudit.counts[table]) continue
    if (!(await tableExists(client, table))) continue
    const { rows } = await client.query(`SELECT * FROM public.${table} LIMIT 50`)
    sample[table] = rows
  }

  const payload = {
    created_at: new Date().toISOString(),
    project_ref: projectRef,
    database: dbAudit,
    storage: storageAudit,
    sample_rows: sample,
    preserve_tables: PRESERVE_TABLES,
    storage_buckets_preserve: STORAGE_BUCKETS_PRESERVE,
  }

  const file = resolve(dir, 'backup-summary.json')
  writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`\nZáloha uložena: ${file}`)
  return dir
}

async function executeCleanup(client) {
  await client.query('BEGIN')
  try {
    for (const table of CONTENT_TABLES) {
      if (!(await tableExists(client, table))) continue
      const count = await countTable(client, table)
      if (!count) continue
      await client.query(`DELETE FROM public.${table}`)
      console.log(`  smazáno ${table}: ${count} řádků`)
    }

    const { rowCount: authDeleted } = await client.query(`
      DELETE FROM auth.users
      WHERE id IN (SELECT id FROM public.profiles WHERE role IS DISTINCT FROM 'administrator')
    `)
    console.log(`  smazáno auth.users (ne-admin): ${authDeleted} účtů`)

    for (const bucket of STORAGE_BUCKETS_TO_CLEAN) {
      const { rowCount } = await client.query(
        `DELETE FROM storage.objects WHERE bucket_id = $1`,
        [bucket]
      )
      if (rowCount > 0) console.log(`  smazáno storage/${bucket}: ${rowCount} souborů`)
    }

    await client.query('COMMIT')
    console.log('\nTransakce dokončena.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function verifyCleanState(client) {
  const issues = []
  for (const table of CONTENT_TABLES) {
    const count = await countTable(client, table)
    if (count > 0) issues.push(`${table}: ${count} řádků`)
  }

  for (const bucket of STORAGE_BUCKETS_TO_CLEAN) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS c FROM storage.objects WHERE bucket_id = $1`,
      [bucket]
    )
    if (rows[0].c > 0) issues.push(`storage/${bucket}: ${rows[0].c} souborů`)
  }

  const { rows: admins } = await client.query(
    `SELECT COUNT(*)::int AS c FROM profiles WHERE role = 'administrator' AND is_active = true`
  )
  if (admins[0].c < 1) issues.push('chybí aktivní administrátor')

  return issues
}

async function runSmokeTest() {
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? process.env.VITE_INITIAL_ADMIN_EMAIL
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD

  if (!anonKey || !adminEmail || !adminPassword) {
    throw new Error('Smoke test vyžaduje VITE_SUPABASE_ANON_KEY, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD')
  }

  const supabase = createClient(url, anonKey)
  const created = { workerId: null, orderId: null, formId: null }

  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (authErr) throw new Error(`Přihlášení: ${authErr.message}`)

  const { data: worker, error: workerErr } = await supabase
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
  if (workerErr) throw new Error(`Zaměstnanec: ${workerErr.message}`)
  created.workerId = worker.id

  const { data: order, error: orderErr } = await supabase
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
  if (orderErr) throw new Error(`Zakázka: ${orderErr.message}`)
  created.orderId = order.id

  const { data: formId, error: formErr } = await supabase.rpc('create_paper_monthly_form', {
    p_month: 7,
    p_year: 2026,
    p_supervisor_id: null,
  })
  if (formErr) throw new Error(`Formulář: ${formErr.message}`)
  created.formId = formId

  const { data: formRow } = await supabase
    .from('paper_monthly_forms')
    .select('form_number')
    .eq('id', formId)
    .single()
  if (!formRow?.form_number?.startsWith('PM-2026-00001')) {
    throw new Error(`Čítač formulářů: očekáváno PM-2026-00001, dostáno ${formRow?.form_number}`)
  }

  return created
}

async function cleanupSmokeTest(client, created) {
  if (created.formId) {
    await client.query(`DELETE FROM paper_monthly_forms WHERE id = $1`, [created.formId])
  }
  if (created.workerId) {
    await client.query(`DELETE FROM workers WHERE id = $1`, [created.workerId])
  }
  if (created.orderId) {
    await client.query(`DELETE FROM job_orders WHERE id = $1`, [created.orderId])
  }
}

console.log('=== VH Bulldig ERP – produkční vyčištění dat ===')
console.log(`Projekt: ${projectRef}`)
console.log(`Režim: ${isAudit ? 'AUDIT' : 'EXECUTE'}${withSmokeTest ? ' + smoke test' : ''}\n`)

const { client, label } = await connectSupabaseDb({ projectRef, dbPassword })
console.log(`Připojeno (${label})`)

try {
  const dbAudit = await auditDatabase(client)
  const storageAudit = await auditStorage(client)
  printAuditReport(dbAudit, storageAudit)

  if (isAudit) {
    console.log('\n=== AUDIT DOKONČEN (bez změn) ===')
    process.exit(0)
  }

  const backupDir = await saveBackup(client, dbAudit, storageAudit)
  console.log('\n=== MAZÁNÍ DAT ===\n')
  await executeCleanup(client)

  const issues = await verifyCleanState(client)
  if (issues.length > 0) {
    console.error('\nVAROVÁNÍ – zbytková data:')
    for (const issue of issues) console.error(`  - ${issue}`)
    process.exit(1)
  }
  console.log('\n=== OVĚŘENÍ: databáze čistá ===')

  if (withSmokeTest) {
    console.log('\n=== SMOKE TEST ===\n')
    const created = await runSmokeTest()
    console.log('  OK přihlášení, zaměstnanec, zakázka, formulář PM-2026-00001')
    await cleanupSmokeTest(client, created)
    console.log('  OK cleanup smoke test dat')
  }

  console.log(`\n=== HOTOVO ===`)
  console.log(`Záloha: ${backupDir}`)
} finally {
  await client.end()
}

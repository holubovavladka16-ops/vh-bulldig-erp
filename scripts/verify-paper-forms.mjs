/**
 * Ověření modulu Papírové formuláře / měsíční docházka
 * node scripts/verify-paper-forms.mjs
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
  console.error('FAIL: Chybí .env.local')
  process.exit(1)
}

const supabase = createClient(url, anonKey)
let passed = 0
let failed = 0

function ok(name) {
  passed++
  console.log(`  OK  ${name}`)
}

function fail(name, detail) {
  failed++
  console.error(`  FAIL ${name}: ${detail}`)
}

console.log('=== OVĚŘENÍ PAPÍROVÉ DOCHÁZKY ===\n')

const { error: authErr } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
if (authErr) {
  fail('Přihlášení', authErr.message)
  process.exit(1)
}
ok('Přihlášení')

const { error: tableErr } = await supabase.from('paper_monthly_forms').select('id').limit(1)
if (tableErr) fail('Tabulka paper_monthly_forms', tableErr.message)
else ok('Tabulka paper_monthly_forms')

const { error: linesErr } = await supabase.from('paper_monthly_form_lines').select('id').limit(1)
if (linesErr) fail('Tabulka paper_monthly_form_lines', linesErr.message)
else ok('Tabulka paper_monthly_form_lines')

const { data: formId, error: createErr } = await supabase.rpc('create_paper_monthly_form', {
  p_month: 7,
  p_year: 2026,
  p_supervisor_id: null,
})
if (createErr) fail('create_paper_monthly_form', createErr.message)
else ok('create_paper_monthly_form')

if (formId) {
  const { data: resolved, error: resolveErr } = await supabase.rpc('resolve_paper_form_public_id', {
    p_public_id: 'INVALID',
  })
  if (resolveErr) fail('resolve_paper_form_public_id', resolveErr.message)
  else ok('resolve_paper_form_public_id')

  const { data: formRow } = await supabase.from('paper_monthly_forms').select('public_id').eq('id', formId).single()
  if (formRow?.public_id) {
    const { data: rows, error: resolve2Err } = await supabase.rpc('resolve_paper_form_public_id', {
      p_public_id: formRow.public_id,
    })
    if (resolve2Err) fail('resolve QR', resolve2Err.message)
    else if (!rows?.[0]?.needs_worker_assignment) fail('resolve QR', 'chybí needs_worker_assignment')
    else ok('resolve QR + needs_worker_assignment')
  }

  const { data: lines } = await supabase
    .from('paper_monthly_form_lines')
    .select('id')
    .eq('paper_form_id', formId)
    .eq('line_role', 'attendance_primary')
  if ((lines?.length ?? 0) >= 28) ok('Seed 31 denních řádků')
  else fail('Seed denních řádků', `počet=${lines?.length ?? 0}`)

  await supabase.from('paper_monthly_forms').delete().eq('id', formId)
  ok('Cleanup testovacího formuláře')
}

const { error: legendErr } = await supabase.rpc('build_paper_order_legend')
if (legendErr) fail('build_paper_order_legend', legendErr.message)
else ok('build_paper_order_legend')

console.log(`\n=== VÝSLEDEK: ${passed} OK, ${failed} FAIL ===`)
process.exit(failed > 0 ? 1 : 0)

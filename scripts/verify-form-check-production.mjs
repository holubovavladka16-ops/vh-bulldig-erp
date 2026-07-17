/**
 * E2E ověření modulu Kontrola formuláře na produkci.
 * Simuluje: QR → potvrzení → upload → OCR API → porovnání → uložení historie.
 *
 * Spuštění: node scripts/verify-form-check-production.mjs
 * Vyžaduje: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD
 * Volitelně: PRODUCTION_URL (výchozí https://erp.vhbulldig.cz)
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
loadEnvFile('.env.production')

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? process.env.VITE_INITIAL_ADMIN_EMAIL
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD
const productionUrl = (process.env.PRODUCTION_URL ?? 'https://erp.vhbulldig.cz').replace(/\/$/, '')

const results = []
let failed = false

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`  OK  ${name}${detail ? ` – ${detail}` : ''}`)
}

function fail(name, detail) {
  results.push({ name, ok: false, detail })
  console.error(`  FAIL ${name}: ${detail}`)
  failed = true
}

function assert(condition, name, detail) {
  if (condition) pass(name, detail)
  else fail(name, detail)
}

if (!url || !anonKey || !adminEmail || !adminPassword) {
  console.error('FAIL: Chybí VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, INITIAL_ADMIN_EMAIL nebo INITIAL_ADMIN_PASSWORD')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

function authHeaders(token) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

async function rest(token, method, path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: authHeaders(token),
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

function numbersEqual(a, b) {
  const na = a == null || a === '' ? null : Number(a)
  const nb = b == null || b === '' ? null : Number(b)
  if (na == null && nb == null) return true
  if (na == null || nb == null) return false
  return Math.abs(na - nb) < 0.01
}

function compareFormWithAttendance(ocrResult, erpDays) {
  const items = []
  let differenceCount = 0

  for (const line of ocrResult.lines) {
    const erp = erpDays.find((d) => d.date === line.formDate)
    const fields = [
      ['hours', line.performanceHours, erp?.hours ?? null],
      ['order', line.orderCode, erp?.orderCode ?? null],
      ['manual_dig', line.manualDigBm, erp?.manualDigBm ?? null],
      ['penetration', line.penetrationKs, erp?.penetrationKs ?? null],
      ['advance', line.dailyAdvance, erp?.advance ?? null],
    ]

    for (const [field, formVal, erpVal] of fields) {
      const formHas = formVal != null && formVal !== ''
      const erpHas = erpVal != null && erpVal !== ''
      let status = 'not_compared'
      if (formHas || erpHas) {
        if (formHas && !erpHas) {
          status = 'missing_in_erp'
          differenceCount++
        } else if (!formHas && erpHas) {
          status = 'missing_on_form'
          differenceCount++
        } else if (field === 'order') {
          const match = String(formVal).toLowerCase() === String(erpVal).toLowerCase()
          status = match ? 'match' : 'mismatch'
          if (!match) differenceCount++
        } else if (numbersEqual(formVal, erpVal)) {
          status = 'match'
        } else {
          status = 'mismatch'
          differenceCount++
        }
      }
      items.push({ field, formDate: line.formDate, status })
    }
  }

  const outcome = differenceCount === 0 ? 'match' : 'mismatch'
  return { outcome, differenceCount, items }
}

console.log('=== E2E KONTROLA FORMULÁŘE (PRODUKCE) ===\n')
console.log(`Backend: ${url}`)
console.log(`Frontend: ${productionUrl}\n`)

let token
let userId

{
  const { data, error } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (error || !data.session) {
    fail('Přihlášení administrátora', error?.message ?? 'Chybí session')
    process.exit(1)
  }
  token = data.session.access_token
  userId = data.user.id
  pass('Přihlášení administrátora', adminEmail)
}

{
  const res = await rest(token, 'GET', 'form_check_records?select=id&limit=1')
  if (res.status === 404 || (res.data?.code === '42P01')) {
    fail('Tabulka form_check_records', 'Tabulka neexistuje – spusťte migrace 060–061')
  } else if (!res.ok) {
    fail('Tabulka form_check_records', JSON.stringify(res.data).slice(0, 200))
  } else {
    pass('Tabulka form_check_records dostupná')
  }
}

let form
{
  const res = await rest(
    token,
    'GET',
    'paper_monthly_forms?select=id,public_id,form_number,worker_id,month,year,worker_snapshot,status&worker_id=not.is.null&limit=1'
  )
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) {
    fail('Načtení testovacího formuláře', 'Žádný formulář s přiřazeným zaměstnancem')
  } else {
    form = res.data[0]
    pass('Načtení testovacího formuláře', form.form_number)
  }
}

let qrContext
if (form) {
  const rpc = await fetch(`${url}/rest/v1/rpc/resolve_paper_form_public_id`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ p_public_id: form.public_id }),
  })
  const rpcData = await rpc.json()
  if (!rpc.ok || !Array.isArray(rpcData) || rpcData.length === 0) {
    fail('QR resolve (RPC)', JSON.stringify(rpcData).slice(0, 200))
  } else {
    qrContext = rpcData[0]
    pass('QR resolve (RPC)', qrContext.form_number)
  }
}

let photoPath = null
if (form) {
  const tinyJpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    'base64'
  )
  photoPath = `form-check/${form.id}/e2e-${Date.now()}.jpg`
  const uploadRes = await fetch(`${url}/storage/v1/object/paper-forms/${photoPath}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: tinyJpeg,
  })
  if (!uploadRes.ok) {
    const body = await uploadRes.text()
    fail('Upload fotografie do Storage', `${uploadRes.status} ${body.slice(0, 200)}`)
  } else {
    pass('Upload fotografie do Storage', photoPath)
  }
}

let ocrResult = null
if (form && qrContext) {
  const ocrContextRes = await rest(
    token,
    'GET',
    `paper_monthly_forms?select=order_legend,month,year,worker_snapshot&id=eq.${form.id}`
  )
  const ocrMeta = ocrContextRes.data?.[0]
  const workerName = ocrMeta?.worker_snapshot
    ? `${ocrMeta.worker_snapshot.last_name} ${ocrMeta.worker_snapshot.first_name}`
    : ''

  const tinyJpegB64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='

  const ocrRes = await fetch(`${productionUrl}/api/ai-form-check-extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      image_base64: tinyJpegB64,
      mime_type: 'image/jpeg',
      order_legend: ocrMeta?.order_legend ?? [],
      month: form.month,
      year: form.year,
      worker_name: workerName,
      form_number: form.form_number,
    }),
  })

  const ocrPayload = await ocrRes.json()
  if (!ocrRes.ok) {
    fail('OCR API na produkci', `${ocrRes.status} ${JSON.stringify(ocrPayload).slice(0, 300)}`)
    // Fallback: syntetický OCR pro zbytek testu
    ocrResult = {
      workerName,
      monthLabel: `${form.month}/${form.year}`,
      month: form.month,
      year: form.year,
      lines: [],
      summary: { totalHours: null, totalBm: null, totalPenetrations: null, totalAdvance: null },
      overallConfidence: 0.5,
      aiModel: 'e2e-fallback',
      storagePath: photoPath,
    }
    console.log('  WARN OCR selhalo – pokračuji se syntetickým OCR pro test uložení')
  } else {
    const lines = Array.isArray(ocrPayload.lines) ? ocrPayload.lines : []
    ocrResult = {
      workerName: ocrPayload.worker_name ?? workerName,
      monthLabel: ocrPayload.month_label ?? null,
      month: ocrPayload.month ?? form.month,
      year: ocrPayload.year ?? form.year,
      lines: lines.map((line) => ({
        formDate: String(line.form_date ?? ''),
        orderCode: line.order_code != null ? String(line.order_code) : null,
        orderName: line.order_name != null ? String(line.order_name) : null,
        performanceHours: line.performance_hours ?? null,
        manualDigBm: line.manual_dig_bm ?? null,
        penetrationKs: line.penetration_ks ?? null,
        dailyAdvance: line.daily_advance ?? null,
        note: line.note != null ? String(line.note) : '',
        confidence: line.ai_confidence ?? null,
      })),
      summary: {
        totalHours: ocrPayload.summary?.total_hours ?? null,
        totalBm: ocrPayload.summary?.total_bm ?? null,
        totalPenetrations: ocrPayload.summary?.total_penetrations ?? null,
        totalAdvance: ocrPayload.summary?.total_advance ?? null,
      },
      overallConfidence: ocrPayload.overall_confidence ?? null,
      aiModel: ocrPayload.ai_model ?? 'gemini',
      storagePath: photoPath,
    }
    pass('OCR API na produkci', `${lines.length} řádků, confidence=${ocrResult.overallConfidence}`)
  }
}

let attendanceRows = []
if (form) {
  const mm = String(form.month).padStart(2, '0')
  const lastDay = new Date(form.year, form.month, 0).getDate()
  const dateFrom = `${form.year}-${mm}-01`
  const dateTo = `${form.year}-${mm}-${String(lastDay).padStart(2, '0')}`
  const attRes = await rest(
    token,
    'GET',
    `worker_attendance_records?select=attendance_date,hours,order_id,daily_advance,note,meters,pieces&worker_id=eq.${form.worker_id}&attendance_date=gte.${dateFrom}&attendance_date=lte.${dateTo}&limit=5`
  )
  if (!attRes.ok) {
    fail('Načtení docházky', JSON.stringify(attRes.data).slice(0, 200))
  } else {
    attendanceRows = attRes.data ?? []
    pass('Načtení docházky', `${attendanceRows.length} záznamů`)

    if (ocrResult && ocrResult.lines.length === 0 && attendanceRows.length > 0) {
      const row = attendanceRows[0]
      ocrResult.lines = [
        {
          formDate: row.attendance_date,
          orderCode: null,
          orderName: null,
          performanceHours: row.hours ?? null,
          manualDigBm: row.meters ?? null,
          penetrationKs: row.pieces ?? null,
          dailyAdvance: row.daily_advance ?? null,
          note: row.note ?? '',
          confidence: 0.95,
        },
      ]
    }
  }
}

let comparisonResult = null
if (ocrResult) {
  const erpDays = attendanceRows.map((row) => ({
    date: row.attendance_date,
    hours: row.hours ?? null,
    orderCode: null,
    orderName: null,
    manualDigBm: row.meters ?? null,
    penetrationKs: row.pieces ?? null,
    advance: row.daily_advance ?? null,
    note: row.note ?? null,
  }))
  comparisonResult = compareFormWithAttendance(ocrResult, erpDays)
  pass(
    'Porovnání OCR s docházkou',
    `outcome=${comparisonResult.outcome}, rozdíly=${comparisonResult.differenceCount}`
  )
}

let savedRecordId = null
if (form && ocrResult && comparisonResult) {
  const insertRes = await rest(token, 'POST', 'form_check_records', {
    form_id: form.id,
    form_number: form.form_number,
    worker_id: form.worker_id,
    month: form.month,
    year: form.year,
    outcome: comparisonResult.outcome,
    difference_count: comparisonResult.differenceCount,
    ocr_confidence: ocrResult.overallConfidence,
    ocr_result: ocrResult,
    comparison_result: comparisonResult,
    photo_path: photoPath,
    checked_by: userId,
  })

  if (!insertRes.ok) {
    fail('Uložení záznamu historie', `${insertRes.status} ${JSON.stringify(insertRes.data).slice(0, 300)}`)
  } else {
    savedRecordId = Array.isArray(insertRes.data) ? insertRes.data[0]?.id : insertRes.data?.id
    pass('Uložení záznamu historie', savedRecordId)
  }
}

if (savedRecordId) {
  const detailRes = await rest(
    token,
    'GET',
    `form_check_records?select=id,form_number,outcome,difference_count,checked_at&id=eq.${savedRecordId}`
  )
  if (!detailRes.ok || !detailRes.data?.[0]) {
    fail('Načtení detailu z historie', JSON.stringify(detailRes.data).slice(0, 200))
  } else {
    pass('Načtení detailu z historie', detailRes.data[0].form_number)
  }

  const listRes = await rest(
    token,
    'GET',
    `form_check_records?select=id&form_id=eq.${form.id}&order=checked_at.desc&limit=5`
  )
  assert(listRes.ok && Array.isArray(listRes.data) && listRes.data.length > 0, 'Seznam historie', `${listRes.data?.length ?? 0} záznamů`)
}

{
  const pageRes = await fetch(`${productionUrl}/kontrola-formulare`, {
    headers: { Accept: 'text/html' },
    redirect: 'follow',
  })
  const html = await pageRes.text()
  const hasPlaceholder = html.includes('Další fáze připravena') || html.includes('Tyto kroky zatím nejsou implementovány')
  if (hasPlaceholder) {
    fail('Produkční frontend bundle', 'Stále obsahuje placeholder text')
  } else if (!pageRes.ok) {
    fail('Produkční frontend', `HTTP ${pageRes.status}`)
  } else {
    pass('Produkční frontend bez placeholder textu', productionUrl)
  }
}

console.log('\n=== SOUHRN ===')
const okCount = results.filter((r) => r.ok).length
const failCount = results.filter((r) => !r.ok).length
console.log(`Úspěšné: ${okCount}, Neúspěšné: ${failCount}`)

if (failed) {
  console.error('\nE2E TEST SELHAL')
  process.exit(1)
}

console.log('\nE2E TEST ÚSPĚŠNÝ – workflow funguje od QR po historii.')
process.exit(0)

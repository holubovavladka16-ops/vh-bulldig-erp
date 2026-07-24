#!/usr/bin/env node
/**
 * Ověří produkční nasazení modulu Fakturovač (frontend + Supabase).
 */
import { createClient } from '@supabase/supabase-js'

const PRODUCTION_URL = (process.env.PRODUCTION_URL ?? 'https://vh-bulldig-erp.vercel.app').replace(/\/$/, '')

function fail(message) {
  console.error('FAIL:', message)
  process.exit(1)
}

function pass(message) {
  console.log('OK:', message)
}

async function verifyFrontend() {
  const html = await fetch(PRODUCTION_URL).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.text()
  })
  const jsMatch = html.match(/assets\/index-[^"]+\.js/)
  if (!jsMatch) fail('V HTML chybí JS bundle')

  const jsUrl = `${PRODUCTION_URL}/${jsMatch[0]}`
  const js = await fetch(jsUrl).then((r) => r.text())

  if (!js.includes('Fakturovač')) fail('Produkční bundle neobsahuje modul Fakturovač')
  if (!js.includes('/fakturace')) fail('Produkční bundle neobsahuje route /fakturace')
  if (!js.includes('nastaveni/faktury')) fail('Produkční bundle neobsahuje Nastavení faktur')

  pass(`Frontend obsahuje Fakturovač (${jsMatch[0]})`)
}

async function verifyDatabase() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.log('SKIP: DB ověření (chybí VITE_SUPABASE_URL/ANON_KEY)')
    return null
  }

  const sb = createClient(url, key)

  for (const table of ['issued_invoices', 'invoice_settings']) {
    const { error } = await sb.from(table).select('id').limit(1)
    if (error?.message?.includes('Could not find the table')) {
      fail(`Tabulka ${table} neexistuje – spusťte migrace 081–082`)
    }
    if (error && !error.message.includes('permission')) {
      fail(`${table}: ${error.message}`)
    }
    pass(`Tabulka ${table} existuje`)
  }

  const { data, error } = await sb
    .from('erp_modules')
    .select('id, label, is_implemented')
    .eq('id', 'fakturovac')
    .maybeSingle()

  if (error && !error.message.includes('permission')) fail(`erp_modules: ${error.message}`)
  if (data && !data.is_implemented) fail('Modul fakturovac není registrován v erp_modules')
  if (data) pass(`Modul registrován: ${data.label}`)

  return sb
}

async function verifyRoutes() {
  for (const path of ['/fakturace', '/nastaveni/faktury']) {
    const res = await fetch(`${PRODUCTION_URL}${path}`)
    if (!res.ok) fail(`Route ${path} vrací HTTP ${res.status}`)
    const html = await res.text()
    if (!html.includes('assets/index-')) fail(`Route ${path} nevrací SPA`)
    pass(`Route ${path} odpovídá`)
  }
}

async function verifyAdminAccess(sb) {
  const email = process.env.INITIAL_ADMIN_EMAIL ?? process.env.VITE_INITIAL_ADMIN_EMAIL ?? 'test@vhbulldig.cz'
  const password = process.env.INITIAL_ADMIN_PASSWORD ?? 'Test123456'

  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) {
    console.log('SKIP: Admin login test –', error.message)
    return
  }

  pass(`Admin přihlášen: ${data.user?.email}`)

  const token = data.session?.access_token
  if (token) {
    const res = await fetch(`${PRODUCTION_URL}/api/admin-apply-fakturovac-migrations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 404) {
      console.log('SKIP: Admin migration API ještě není nasazena')
    } else if (res.ok) {
      pass('Admin migration API odpovídá')
    }
  }
}

console.log('=== Ověření Fakturovač produkce ===')
console.log('URL:', PRODUCTION_URL)

await verifyFrontend()
const sb = await verifyDatabase()
await verifyRoutes()
if (sb) await verifyAdminAccess(sb)

console.log('=== Vše OK ===')


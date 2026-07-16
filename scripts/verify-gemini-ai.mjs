/**
 * Ověření Gemini AI endpointu na Vercelu.
 * Spusťte: node scripts/verify-gemini-ai.mjs [baseUrl]
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

const baseUrl = (process.argv[2] ?? 'https://vh-bulldig-erp.vercel.app').replace(/\/$/, '')
const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? process.env.VITE_INITIAL_ADMIN_EMAIL
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD
const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!adminEmail || !adminPassword || !url || !anonKey) {
  console.error('FAIL: Chybí proměnné v .env.local')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

const sampleText =
  'dnes jsme kopali rychu 70 cm na zahrade, polozili dve hdpe trubky a udelali tri prurazy do domu'

console.log(`=== TEST GEMINI AI (${baseUrl}) ===\n`)

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: adminEmail,
  password: adminPassword,
})
if (authErr || !auth.session) {
  console.error('FAIL: Přihlášení:', authErr?.message ?? 'bez session')
  process.exit(1)
}
console.log('  OK  Přihlášení administrátora')

for (const context of ['diary', 'daily_form']) {
  const res = await fetch(`${baseUrl}/api/ai-polish-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.session.access_token}`,
    },
    body: JSON.stringify({ rough_text: sampleText, context }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    console.error(`  FAIL AI (${context}): HTTP ${res.status} – ${data.error ?? 'neznámá chyba'}`)
    process.exit(1)
  }

  if (!data.polished_text || data.polished_text.length < 20) {
    console.error(`  FAIL AI (${context}): prázdná nebo příliš krátká odpověď`)
    process.exit(1)
  }

  const hasDiacritics = /[áčďéěíňóřšťúůýž]/i.test(data.polished_text)
  if (!hasDiacritics) {
    console.error(`  FAIL AI (${context}): text bez diakritiky – ${data.polished_text}`)
    process.exit(1)
  }

  console.log(`  OK  AI ${context}: ${data.polished_text.slice(0, 80)}…`)
}

await supabase.auth.signOut()

console.log('\n=== GEMINI AI OK ===')

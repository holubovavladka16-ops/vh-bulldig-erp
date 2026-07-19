/**
 * Ověří produkční schéma fotodokumentace a testuje insert do gps_photos.
 * Vyžaduje: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD
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

if (!url || !anonKey || !adminEmail || !adminPassword) {
  console.error('FAIL: Chybí VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, INITIAL_ADMIN_EMAIL nebo INITIAL_ADMIN_PASSWORD')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

console.log('=== Ověření fotodokumentace (produkce) ===\n')

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: adminEmail,
  password: adminPassword,
})
if (authError || !auth.user) {
  console.error('FAIL: Přihlášení:', authError?.message ?? 'neznámá chyba')
  process.exit(1)
}
console.log('OK: Přihlášení administrátora')

const { data: order } = await supabase
  .from('job_orders')
  .select('id, name')
  .limit(1)
  .maybeSingle()

if (!order?.id) {
  console.error('FAIL: V databázi není žádná zakázka pro test')
  process.exit(1)
}

const now = new Date()
const testPath = `test/fotodokumentace/${Date.now()}_verify.jpg`

const { error: uploadError } = await supabase.storage.from('gps-photos').upload(
  testPath,
  new Blob(['test-foto'], { type: 'image/jpeg' }),
  { contentType: 'image/jpeg', upsert: false }
)
if (uploadError) {
  console.error('FAIL: Upload do Storage:', uploadError.message)
  process.exit(1)
}
console.log('OK: Testovací soubor nahrán do Storage')

const insertPayload = {
  file_path: testPath,
  file_name: 'verify_test.jpg',
  original_file_path: testPath,
  captured_at: now.toISOString(),
  captured_date: now.toISOString().slice(0, 10),
  captured_time: now.toTimeString().slice(0, 8),
  uploaded_at: now.toISOString(),
  gps_lat: 49.025841,
  gps_lng: 17.647921,
  gps_accuracy: 8,
  gps_status: 'verified',
  approval_status: 'nova',
  sync_status: 'synced',
  address_full: 'Testovací adresa',
  street: 'Test',
  city: 'Uherský Brod',
  postal_code: '68801',
  district: '',
  region: '',
  country: 'Česko',
  order_id: order.id,
  created_by: auth.user.id,
}

const { data: inserted, error: insertError } = await supabase
  .from('gps_photos')
  .insert(insertPayload)
  .select('id, approval_status, gps_status')
  .single()

if (insertError) {
  console.error('FAIL: Insert gps_photos:', insertError.message)
  if (insertError.message.includes('approval_status')) {
    console.error('→ Spusťte: npm run apply-fotodokumentace-migration')
  }
  await supabase.storage.from('gps-photos').remove([testPath])
  process.exit(1)
}

console.log('OK: Insert gps_photos včetně approval_status', inserted)

await supabase.from('gps_photos').delete().eq('id', inserted.id)
await supabase.storage.from('gps-photos').remove([testPath])
console.log('OK: Testovací záznam smazán')

console.log('\nOK: Produkční test fotodokumentace prošel.')

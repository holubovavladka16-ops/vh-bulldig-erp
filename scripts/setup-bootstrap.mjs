import { readFileSync, existsSync } from 'node:fs'
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

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const dbPassword = process.env.SUPABASE_DB_PASSWORD
const email = process.env.INITIAL_ADMIN_EMAIL ?? process.env.VITE_INITIAL_ADMIN_EMAIL
const password = process.env.INITIAL_ADMIN_PASSWORD
const sqlFile = resolve(process.cwd(), 'supabase/apply-all-migrations.sql')

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

if (!url || !anonKey) fail('Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY v .env.local')
if (!email || !password) fail('Chybí INITIAL_ADMIN_EMAIL nebo INITIAL_ADMIN_PASSWORD v .env.local')

const projectRef = getProjectRef(url)
if (!projectRef) fail(`Neplatná VITE_SUPABASE_URL: ${url}`)

const supabase = createClient(url, anonKey)

async function schemaReady() {
  const { error } = await supabase.rpc('system_needs_bootstrap')
  return !error
}

console.log('Kontrola schématu databáze…')
let ready = await schemaReady()

if (!ready && dbPassword && existsSync(sqlFile)) {
  console.log('Aplikuji migrace přes PostgreSQL…')
  let client
  try {
    const connection = await connectSupabaseDb({ projectRef, dbPassword })
    client = connection.client
    console.log(`Připojeno (${connection.label}).`)
    await client.query(readFileSync(sqlFile, 'utf8'))
  } catch (error) {
    fail(`Migrace selhaly: ${error.message}`)
  } finally {
    await client?.end().catch(() => {})
  }
  ready = await schemaReady()
}

if (!ready) {
  fail(
    'Databáze nemá aplikované migrace. Spusťte nejdřív: npm run apply-migrations-dashboard (s SUPABASE_ACCESS_TOKEN) nebo npm run run-apply-all-migrations (s SUPABASE_DB_PASSWORD).'
  )
}

console.log('Bootstrap administrátora…')
const { data: needsBootstrap, error: bootstrapCheckError } = await supabase.rpc('system_needs_bootstrap')
if (bootstrapCheckError) fail(`Kontrola bootstrapu: ${bootstrapCheckError.message}`)

if (needsBootstrap) {
  const { error: bootstrapError } = await supabase.rpc('bootstrap_first_admin', {
    p_email: email,
    p_password: password,
    p_full_name: 'Administrátor',
  })
  if (bootstrapError) fail(`Vytvoření administrátora: ${bootstrapError.message}`)
  console.log(`Administrátor ${email} vytvořen.`)
} else {
  console.log('Administrátor již existuje.')
}

console.log('Test přihlášení…')
const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
if (signInError) fail(`Přihlášení selhalo: ${signInError.message}`)

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role, full_name, is_active')
  .eq('id', signInData.user.id)
  .single()
if (profileError) fail(`Načtení profilu: ${profileError.message}`)
if (profile.role !== 'administrator') fail(`Účet nemá roli administrator (má: ${profile.role})`)

await supabase.auth.signOut()

console.log('')
console.log('=== PŘIHLÁŠENÍ OVĚŘENO ===')
console.log(`URL aplikace:     http://localhost:5173/`)
console.log(`E-mail admina:    ${email}`)
console.log(`Heslo admina:     ${password}`)
console.log(`Profil:           ${profile.full_name} (${profile.role})`)

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename)
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function isPlaceholderValue(value) {
  if (!value?.trim()) return true
  const normalized = value.trim().toLowerCase()
  const markers = ['vas-projekt', 'vase-anon-key', 'your-project', 'your-anon-key', 'placeholder']
  return markers.some((marker) => normalized.includes(marker))
}

loadEnvFile('.env')
loadEnvFile('.env.local')

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.INITIAL_ADMIN_EMAIL ?? process.env.VITE_INITIAL_ADMIN_EMAIL
const password = process.env.INITIAL_ADMIN_PASSWORD

if (!url || !anonKey || isPlaceholderValue(url) || isPlaceholderValue(anonKey)) {
  console.error('Chybí platná VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY v .env / .env.local.')
  console.error('Získejte hodnoty v Supabase Dashboard → Project Settings → API.')
  process.exit(1)
}

if (!email || !password) {
  console.error('Nastavte INITIAL_ADMIN_EMAIL a INITIAL_ADMIN_PASSWORD v .env.local (heslo nepatří do gitu).')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

const { data: needsBootstrap, error: checkError } = await supabase.rpc('system_needs_bootstrap')
if (checkError) {
  console.error('Chyba kontroly bootstrapu:', checkError.message)
  console.error('Ověřte, že běží Supabase a že jsou aplikovány migrace (017_admin_accounts.sql).')
  process.exit(1)
}

if (!needsBootstrap) {
  console.log('Administrátor již existuje – bootstrap není potřeba.')
  process.exit(0)
}

const { error } = await supabase.rpc('bootstrap_first_admin', {
  p_email: email,
  p_password: password,
  p_full_name: 'Administrátor',
})

if (error) {
  console.error('Vytvoření administrátora se nezdařilo:', error.message)
  process.exit(1)
}

const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
if (signInError) {
  console.warn('Administrátor vytvořen, ale test přihlášení selhal:', signInError.message)
} else {
  console.log('Test přihlášení administrátora proběhl úspěšně.')
}

console.log(`Administrátor ${email} byl úspěšně vytvořen.`)

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

const projectRef = getProjectRef(process.env.VITE_SUPABASE_URL)
const { client } = await connectSupabaseDb({
  projectRef,
  dbPassword: process.env.SUPABASE_DB_PASSWORD,
})

const users = await client.query(
  `SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed,
          encrypted_password IS NOT NULL AS has_password
   FROM auth.users WHERE email = $1`,
  [process.env.INITIAL_ADMIN_EMAIL]
)
const identities = await client.query(
  `SELECT COUNT(*)::int AS count FROM auth.identities
   WHERE user_id IN (SELECT id FROM auth.users WHERE email = $1)`,
  [process.env.INITIAL_ADMIN_EMAIL]
)
const profiles = await client.query(
  `SELECT role, is_active FROM profiles WHERE email = $1`,
  [process.env.INITIAL_ADMIN_EMAIL]
)

console.log('auth_user_exists:', users.rowCount > 0)
if (users.rows[0]) {
  console.log('confirmed:', users.rows[0].confirmed)
  console.log('has_password:', users.rows[0].has_password)
}
console.log('identity_count:', identities.rows[0]?.count ?? 0)
console.log('profile:', profiles.rows[0] ?? null)

await client.end()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const { data, error } = await supabase.auth.signInWithPassword({
  email: process.env.INITIAL_ADMIN_EMAIL,
  password: process.env.INITIAL_ADMIN_PASSWORD,
})

if (error) {
  console.log('login_status: FAIL')
  console.log('login_message:', error.message || '(prázdná zpráva)')
  console.log('login_code:', error.code ?? '(none)')
  console.log('login_status_code:', error.status ?? '(none)')
  process.exit(1)
}

console.log('login_status: OK')
console.log('user:', data.user?.email)

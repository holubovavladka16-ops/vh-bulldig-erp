import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

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

console.log('=== PRODUCTION SUPABASE CHECK ===')
console.log('Supabase URL:', url)
console.log('Anon Key:', anonKey ? anonKey.substring(0, 20) + '...' : 'MISSING')

const supabase = createClient(url, anonKey)

const testEmail = 'test@vhbulldig.cz'
const testPassword = 'Test123456'

console.log('\nTesting login with:', testEmail)

const { data, error } = await supabase.auth.signInWithPassword({ 
  email: testEmail, 
  password: testPassword 
})

if (error) {
  console.error('❌ LOGIN FAILED:', error.message)
  console.error('Error code:', error.status)
  
  // Check if user exists in auth
  console.log('\nAttempting to check if user exists...')
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const testUser = users.find(u => u.email === testEmail)
  
  if (testUser) {
    console.log('✅ User exists in auth.users')
    console.log('User ID:', testUser.id)
    console.log('Email confirmed:', testUser.email_confirmed_at ? 'YES' : 'NO')
  } else {
    console.log('❌ User does NOT exist in auth.users')
  }
  
  // Check profiles
  const { data: profiles } = await supabase.from('profiles').select('*').eq('email', testEmail)
  if (profiles && profiles.length > 0) {
    console.log('✅ Profile exists in profiles table')
    console.log('Profile:', profiles[0])
  } else {
    console.log('❌ Profile does NOT exist in profiles table')
  }
  
  process.exit(1)
}

console.log('✅ LOGIN SUCCESSFUL')
console.log('User ID:', data.user?.id)
console.log('Email:', data.user?.email)
console.log('Email confirmed:', data.user?.email_confirmed_at ? 'YES' : 'NO')

// Check profile
const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
if (profile) {
  console.log('✅ Profile found')
  console.log('Role:', profile.role)
  console.log('Is active:', profile.is_active)
} else {
  console.log('❌ Profile NOT found')
}

await supabase.auth.signOut()
console.log('\n=== CHECK COMPLETE ===')

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename)
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    env[key] = value
  }
  return env
}

console.log('=== BUILD ENVIRONMENT VERIFICATION ===\n')

const prodEnv = loadEnvFile('.env.production')
const localEnv = loadEnvFile('.env.local')

console.log('.env.production:')
console.log('VITE_SUPABASE_URL:', prodEnv.VITE_SUPABASE_URL || 'MISSING')
console.log('VITE_SUPABASE_ANON_KEY:', prodEnv.VITE_SUPABASE_ANON_KEY ? prodEnv.VITE_SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'MISSING')
console.log('VITE_INITIAL_ADMIN_EMAIL:', prodEnv.VITE_INITIAL_ADMIN_EMAIL || 'MISSING')

console.log('\n.env.local:')
console.log('VITE_SUPABASE_URL:', localEnv.VITE_SUPABASE_URL || 'MISSING')
console.log('VITE_SUPABASE_ANON_KEY:', localEnv.VITE_SUPABASE_ANON_KEY ? localEnv.VITE_SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'MISSING')
console.log('INITIAL_ADMIN_EMAIL:', localEnv.INITIAL_ADMIN_EMAIL || 'MISSING')

console.log('\nProcess environment at build time:')
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL || 'MISSING')
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? process.env.VITE_SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'MISSING')

if (!prodEnv.VITE_SUPABASE_URL || !prodEnv.VITE_SUPABASE_ANON_KEY) {
  console.log('\n❌ ERROR: .env.production is missing Supabase configuration')
  process.exit(1)
}

console.log('\n✅ .env.production contains required Supabase configuration')

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const ENV_FILE = resolve(ROOT, '.local-stack/runtime.env.json')

if (!existsSync(ENV_FILE)) {
  console.error('FAIL: Lokální stack neběží')
  process.exit(1)
}

const runtime = JSON.parse(readFileSync(ENV_FILE, 'utf8'))
const supabase = createClient(runtime.url, runtime.anonKey)

const { error: bootstrapError } = await supabase.rpc('system_needs_bootstrap')
if (bootstrapError) {
  console.error('FAIL: RPC system_needs_bootstrap:', bootstrapError.message)
  process.exit(1)
}

const { error: signInError } = await supabase.auth.signInWithPassword({
  email: runtime.adminEmail,
  password: runtime.adminPassword,
})

if (signInError) {
  console.error('FAIL: Přihlášení:', signInError.message)
  process.exit(1)
}

const userId = (await supabase.auth.getUser()).data.user?.id
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', userId)
  .single()

if (profileError || profile?.role !== 'administrator') {
  console.error('FAIL: Profil administrátora:', profileError?.message ?? profile?.role)
  process.exit(1)
}

console.log('OK: Lokální přihlášení funguje')
process.exit(0)

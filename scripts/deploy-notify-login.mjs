/**
 * Nasazení Edge Function notify-login na Supabase Cloud.
 * Před prvním spuštěním nastavte Secrets v Supabase Dashboard:
 *   RESEND_API_KEY       – API klíč z https://resend.com
 *   LOGIN_NOTIFY_EMAIL   – holubovavladka16@gmail.com (volitelné, výchozí)
 *   RESEND_FROM          – VH Bulldig ERP <onboarding@resend.dev>
 */
import { spawnSync } from 'node:child_process'
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

loadEnvFile('.env.local')

const projectRef =
  process.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ??
  'khhalcjgvqoyskkjlkyg'

console.log(`Nasazuji notify-login na projekt ${projectRef}…`)

const result = spawnSync(
  'npx',
  ['supabase', 'functions', 'deploy', 'notify-login', '--project-ref', projectRef],
  { stdio: 'inherit', shell: true, encoding: 'utf8' }
)

if (result.status !== 0) {
  console.error('\nDeploy selhal. Alternativa: Supabase Dashboard → Edge Functions → Deploy')
  process.exit(result.status ?? 1)
}

console.log('\nOK: notify-login nasazena.')
console.log('Nezapomeňte nastavit Secrets: RESEND_API_KEY, LOGIN_NOTIFY_EMAIL')

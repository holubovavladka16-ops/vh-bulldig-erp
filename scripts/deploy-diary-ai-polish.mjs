/**
 * Nasazení Edge Function diary-ai-polish na Supabase Cloud.
 * Vyžaduje: supabase CLI, GEMINI_API_KEY v Supabase Secrets.
 *
 *   supabase secrets set GEMINI_API_KEY=your_key --project-ref <ref>
 *   node scripts/deploy-diary-ai-polish.mjs
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

loadEnvFile('.env')
loadEnvFile('.env.local')

const projectRef =
  process.env.SUPABASE_PROJECT_REF ??
  process.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('Chybí SUPABASE_PROJECT_REF nebo VITE_SUPABASE_URL v .env')
  process.exit(1)
}

console.log(`Nasazuji diary-ai-polish na projekt ${projectRef}…`)

const result = spawnSync(
  'npx',
  ['supabase', 'functions', 'deploy', 'diary-ai-polish', '--project-ref', projectRef],
  { stdio: 'inherit', shell: true }
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log('\nOK: diary-ai-polish nasazena.')
console.log('Nezapomeňte nastavit secret: supabase secrets set GEMINI_API_KEY=... --project-ref', projectRef)

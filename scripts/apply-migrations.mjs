import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

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
const dbPassword = process.env.SUPABASE_DB_PASSWORD

if (!url) {
  console.error('FAIL: Chybí VITE_SUPABASE_URL v .env.local')
  process.exit(1)
}

const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!projectRef) {
  console.error('FAIL: Neplatná VITE_SUPABASE_URL:', url)
  process.exit(1)
}

if (!dbPassword) {
  console.error('FAIL: Chybí SUPABASE_DB_PASSWORD v .env.local')
  console.error('Heslo k databázi najdete v Supabase Dashboard → Project Settings → Database.')
  console.error('Alternativa: spusťte SQL migrace ručně v SQL Editoru ze složky supabase/migrations.')
  process.exit(1)
}

const encodedPassword = encodeURIComponent(dbPassword)
const dbUrl = `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`

console.log(`Aplikuji migrace na projekt ${projectRef}…`)

const result = spawnSync('npx', ['supabase', 'db', 'push', '--db-url', dbUrl], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
})

process.exit(result.status ?? 1)

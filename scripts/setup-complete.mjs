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

const hasDbPassword = Boolean(process.env.SUPABASE_DB_PASSWORD)
const hasAccessToken = Boolean(process.env.SUPABASE_ACCESS_TOKEN)

if (!hasDbPassword && !hasAccessToken) {
  console.error('FAIL: Přidejte do .env.local jednu z možností:')
  console.error('  SUPABASE_DB_PASSWORD=...   (Dashboard → Settings → Database)')
  console.error('  SUPABASE_ACCESS_TOKEN=...  (Dashboard → Account → Access Tokens)')
  process.exit(1)
}

console.log('=== VH Bulldig ERP – kompletní setup ===\n')
spawnSync('node', ['scripts/build-apply-all-sql.mjs'], { stdio: 'inherit', shell: true })

if (hasAccessToken) {
  const r = spawnSync('node', ['scripts/apply-migrations-dashboard.mjs'], { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
} else {
  const r = spawnSync('node', ['scripts/run-apply-all-migrations.mjs'], { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const setup = spawnSync('node', ['scripts/setup-bootstrap.mjs'], { stdio: 'inherit', shell: true })
process.exit(setup.status ?? 1)

/**
 * Aplikuje migrace přes Supabase Management API (bez SUPABASE_DB_PASSWORD).
 * Vyžaduje SUPABASE_ACCESS_TOKEN v .env.local (Dashboard → Account → Access Tokens).
 */
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

const token = process.env.SUPABASE_ACCESS_TOKEN
const url = process.env.VITE_SUPABASE_URL
const sqlFile = resolve(process.cwd(), 'supabase/apply-all-migrations.sql')

if (!token) {
  console.error('FAIL: Chybí SUPABASE_ACCESS_TOKEN v .env.local')
  console.error('Vytvořte token: https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

const projectRef = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? process.env.SUPABASE_PROJECT_REF
if (!projectRef) {
  console.error('FAIL: Chybí VITE_SUPABASE_URL nebo SUPABASE_PROJECT_REF')
  process.exit(1)
}

if (!existsSync(sqlFile)) {
  console.error('FAIL: Chybí apply-all-migrations.sql – spusťte npm run build-apply-all-sql')
  process.exit(1)
}

const sql = readFileSync(sqlFile, 'utf8')
const parts = sql.split(/^-- MIGRATION: /m).slice(1)
const chunks = parts.map((part) => {
  const nl = part.indexOf('\n')
  const name = part.slice(0, nl).trim()
  const body = part.slice(nl + 1).replace(/^-- =+\s*\n/m, '').trim()
  return { name, sql: body }
})

console.log(`Aplikuji ${chunks.length} migrací na ${projectRef} přes Management API…`)

for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i]
  process.stdout.write(`  [${i + 1}/${chunks.length}] ${chunk.name}… `)

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: chunk.sql }),
  })

  const body = await response.text()
  if (!response.ok) {
    console.error('\nFAIL:', chunk.name, response.status, body.slice(0, 500))
    process.exit(1)
  }
  console.log('OK')
}

console.log('OK: Všechny migrace aplikovány.')

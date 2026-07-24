#!/usr/bin/env node
/**
 * Produkční nasazení modulu Fakturovač.
 *
 * 1. Migrace 081–082 (Supabase)
 * 2. Build + Vercel deploy (CLI nebo deploy hook)
 * 3. Ověření produkce
 */
import { execSync } from 'node:child_process'
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

const steps = []

function run(label, fn) {
  process.stdout.write(`${label}… `)
  try {
    fn()
    steps.push({ label, ok: true })
    console.log('OK')
  } catch (error) {
    steps.push({ label, ok: false, error: error.message })
    console.log('FAIL')
    throw error
  }
}

console.log('=== Nasazení Fakturovač produkce ===\n')

try {
  run('Migrace 081–082', () => {
    execSync('node scripts/apply-fakturovac-migrations-081-082.mjs', { stdio: 'inherit' })
  })
} catch {
  console.error('\nMigrace selhaly – zkuste SQL: supabase/manual/081_082_fakturovac_production.sql')
  process.exit(1)
}

run('Build', () => {
  execSync('npm run build', { stdio: 'inherit' })
})

const hasVercelCli =
  process.env.VERCEL_TOKEN && process.env.VERCEL_ORG_ID && process.env.VERCEL_PROJECT_ID

if (hasVercelCli) {
  run('Vercel deploy (CLI)', () => {
    execSync('npx vercel@latest deploy --prebuilt --prod --yes', { stdio: 'inherit' })
  })
} else if (process.env.VERCEL_DEPLOY_HOOK) {
  run('Vercel deploy (hook)', () => {
    execSync(`curl -fsS -X POST "${process.env.VERCEL_DEPLOY_HOOK}"`, { stdio: 'inherit' })
  })
} else {
  console.error('\nFAIL: Chybí VERCEL_TOKEN/ORG_ID/PROJECT_ID nebo VERCEL_DEPLOY_HOOK')
  console.error('Frontend nelze nasadit automaticky.')
  process.exit(1)
}

if (process.env.VERCEL_DEPLOY_HOOK && !hasVercelCli) {
  console.log('Čekám 90 s na dokončení Vercel buildu…')
  await new Promise((r) => setTimeout(r, 90000))
}

try {
  run('Ověření produkce', () => {
    execSync('node scripts/verify-fakturovac-production.mjs', { stdio: 'inherit' })
  })
} catch {
  console.warn('WARN: Ověření produkce selhalo – zkontrolujte ručně')
}

console.log('\n=== NASAZENÍ DOKONČENO ===')

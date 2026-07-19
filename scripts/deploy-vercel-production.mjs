#!/usr/bin/env node
/**
 * Ruční produkční deploy na Vercel.
 *
 * Vyžaduje env:
 *   VERCEL_TOKEN      – https://vercel.com/account/tokens
 *   VERCEL_ORG_ID     – z .vercel/project.json
 *   VERCEL_PROJECT_ID – z .vercel/project.json
 *
 * Použití:
 *   npm run build
 *   VERCEL_TOKEN=xxx VERCEL_ORG_ID=xxx VERCEL_PROJECT_ID=xxx node scripts/deploy-vercel-production.mjs
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const required = ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']
const missing = required.filter((k) => !process.env[k]?.trim())

if (missing.length) {
  console.error('Chybí proměnné:', missing.join(', '))
  console.error('Viz komentář v scripts/deploy-vercel-production.mjs')
  process.exit(1)
}

if (!existsSync('dist/index.html')) {
  console.log('Build dist/…')
  execSync('npm run build', { stdio: 'inherit' })
}

console.log('Deploy na Vercel production…')
execSync('npx vercel@latest deploy --prebuilt --prod --yes', {
  stdio: 'inherit',
  env: process.env,
})

console.log('Hotovo: https://vh-bulldig-erp.vercel.app')

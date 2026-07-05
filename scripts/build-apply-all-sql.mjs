import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'supabase/migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const lines = [
  '-- =============================================================================',
  '-- VH Bulldig ERP - All Migrations (001-019)',
  '-- Project: khhalcjgvqoyskkjlkyg',
  '-- Run in Supabase Dashboard -> SQL Editor -> New query',
  `-- Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
  '-- =============================================================================',
  '',
]

for (const f of files) {
  lines.push('')
  lines.push('-- =============================================================================')
  lines.push(`-- MIGRATION: ${f}`)
  lines.push('-- =============================================================================')
  lines.push('')
  lines.push(readFileSync(join(dir, f), 'utf8').trimEnd())
  lines.push('')
}

const out = join(process.cwd(), 'supabase/apply-all-migrations.sql')
writeFileSync(out, lines.join('\n'), 'utf8')
console.log(`Created ${out} with ${files.length} migrations (${readFileSync(out).length} bytes)`)

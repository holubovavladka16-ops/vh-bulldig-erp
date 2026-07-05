import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

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
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const placeholderMarkers = ['vas-projekt', 'vase-anon-key', 'your-project', 'your-anon-key', 'placeholder']

function isPlaceholder(value) {
  if (!value?.trim()) return true
  const normalized = value.trim().toLowerCase()
  return placeholderMarkers.some((marker) => normalized.includes(marker))
}

if (!url || !anonKey || isPlaceholder(url) || isPlaceholder(anonKey)) {
  console.error('FAIL: Chybí platná VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY v .env.local')
  console.error('Získejte hodnoty v Supabase Dashboard → Project Settings → API Keys.')
  process.exit(1)
}

console.log(`Kontrola připojení: ${url}`)

const supabase = createClient(url, anonKey)
const { data, error } = await supabase.rpc('system_needs_bootstrap')

if (error) {
  console.error('FAIL:', error.message)
  process.exit(1)
}

console.log('OK: Supabase odpovídá.')
console.log(`Bootstrap potřebný: ${data ? 'ano' : 'ne'}`)

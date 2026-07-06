import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function parseEnvFile(filePath) {
  const out = {}
  if (!existsSync(filePath)) return out

  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    out[key] = value
  }

  return out
}

export function getSupabaseConfig() {
  const fromProcess = {
    url: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
  }

  if (fromProcess.url && fromProcess.anonKey) {
    return fromProcess
  }

  const prod = parseEnvFile(resolve(process.cwd(), '.env.production'))
  return {
    url: fromProcess.url ?? prod.VITE_SUPABASE_URL,
    anonKey: fromProcess.anonKey ?? prod.VITE_SUPABASE_ANON_KEY,
  }
}

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY ?? ''
}

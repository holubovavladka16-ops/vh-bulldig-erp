#!/usr/bin/env node
/**
 * Smoke test produkce po nasazení PDF 8 modulu.
 * Ověří frontend bundle, dostupnost modulu a REST API tabulek.
 */
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

loadEnvFile('.env.production')

const urls = [
  process.env.PRODUCTION_URL,
  'https://erp.vhbulldig.cz',
  'https://vh-bulldig-erp.vercel.app',
].filter(Boolean)

/** @type {{ check: string; ok: boolean; detail: string }[]} */
const checks = []

function pass(check, detail = '') {
  checks.push({ check, ok: true, detail })
  console.log(`OK: ${check}${detail ? ` – ${detail}` : ''}`)
}

function fail(check, detail = '') {
  checks.push({ check, ok: false, detail })
  console.error(`FAIL: ${check}${detail ? ` – ${detail}` : ''}`)
}

async function main() {
  console.log('=== PDF 8 Production Smoke Test ===')

  let workingUrl = null
  for (const url of [...new Set(urls)]) {
    try {
      const res = await fetch(`${url}/prihlaseni`)
      if (res.ok) {
        workingUrl = url
        pass('Frontend /prihlaseni', `${url} HTTP ${res.status}`)
        break
      }
    } catch (error) {
      fail('Frontend /prihlaseni', `${url}: ${error.message}`)
    }
  }

  if (workingUrl) {
    const html = await fetch(workingUrl).then((r) => r.text())
    const jsMatch = html.match(/assets\/index-[^"]+\.js/)
    if (jsMatch) {
      const js = await fetch(`${workingUrl}/${jsMatch[0]}`).then((r) => r.text())
      if (js.includes('zakazky-mapa') || js.includes('ZakazkyMapa') || js.includes('ProjectMap')) {
        pass('Frontend bundle obsahuje modul mapy')
      } else {
        fail('Frontend bundle obsahuje modul mapy', 'String zakazky-mapa nenalezen – může být minifikováno')
      }
    } else {
      fail('Frontend JS bundle v HTML')
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (supabaseUrl && anonKey) {
    const supabase = createClient(supabaseUrl, anonKey)
    const { error: modErr } = await supabase.from('erp_modules').select('id,is_implemented').eq('id', 'zakazky-mapa').single()
    if (modErr) fail('erp_modules REST', modErr.message)
    else pass('erp_modules REST dostupné')

    const { error: markerErr } = await supabase.from('project_map_markers').select('id').limit(1)
    if (markerErr?.code === 'PGRST205') fail('project_map_markers tabulka', 'Tabulka neexistuje')
    else if (markerErr?.message?.includes('permission')) pass('project_map_markers RLS chrání data', markerErr.message)
    else pass('project_map_markers tabulka existuje')
  } else {
    fail('Supabase env pro REST smoke test')
  }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\n=== Výsledek: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${checks.length - failed.length}/${checks.length}) ===`)
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

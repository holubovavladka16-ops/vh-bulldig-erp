/**
 * Ověření připojení Supabase a připravenosti přepínání Design 1 / Design 2.
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

loadEnvFile('.env.local')

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? process.env.VITE_INITIAL_ADMIN_EMAIL
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD

const results = []
function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`  OK  ${name}${detail ? ` – ${detail}` : ''}`)
}
function fail(name, detail) {
  results.push({ name, ok: false, detail })
  console.error(`  FAIL ${name}: ${detail}`)
}

console.log('=== OVĚŘENÍ SUPABASE + DESIGN ===\n')

if (!url || !anonKey) {
  fail('Env: Supabase klíče', 'Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}
pass('Env: Supabase klíče', url)

const css = readFileSync(resolve('src/index.css'), 'utf8')
css.includes('[data-app-design="design_2"]') ? pass('CSS: Design 2 tokeny') : fail('CSS: Design 2 tokeny', 'Chybí v index.css')
css.includes('[data-app-design="design_1"]') ? pass('CSS: Design 1 tokeny') : fail('CSS: Design 1 tokeny', 'Chybí v index.css')

const supabase = createClient(url, anonKey)

const bootstrap = await supabase.rpc('system_needs_bootstrap')
bootstrap.error ? fail('Supabase: bootstrap RPC', bootstrap.error.message) : pass('Supabase: bootstrap RPC', bootstrap.data ? 'potřebný' : 'hotový')

const designRpc = await supabase.rpc('get_app_design')
if (designRpc.error) {
  fail('Migrace 044: get_app_design', designRpc.error.message)
} else {
  pass('Migrace 044: get_app_design', String(designRpc.data))
}

try {
  const head = await fetch(`${url}/rest/v1/`, { method: 'HEAD', headers: { apikey: anonKey } })
  head.ok || head.status === 404 || head.status === 401
    ? pass('Supabase: REST API')
    : fail('Supabase: REST API', String(head.status))
} catch (err) {
  fail('Supabase: REST API', err.message)
}

if (!adminPassword) {
  fail('Přihlášení', 'Chybí INITIAL_ADMIN_PASSWORD v .env.local – doplňte pro plný test')
} else {
  const login = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
  if (login.error) {
    fail('Přihlášení', login.error.message)
  } else {
    pass('Přihlášení', adminEmail)

    const { data: settings, error: settingsErr } = await supabase
      .from('company_settings')
      .select('id,app_design')
      .limit(1)
      .maybeSingle()

    if (settingsErr) {
      fail('company_settings.app_design', settingsErr.message)
    } else {
      pass('company_settings.app_design', settings?.app_design ?? 'design_1')
    }

    if (!designRpc.error && settings?.id) {
      const original = settings.app_design ?? 'design_1'
      const target = original === 'design_1' ? 'design_2' : 'design_1'

      const { error: updateErr } = await supabase
        .from('company_settings')
        .update({ app_design: target })
        .eq('id', settings.id)

      if (updateErr) {
        fail('Design: uložení', updateErr.message)
      } else {
        const verify = await supabase.rpc('get_app_design')
        verify.data === target ? pass('Design: přepnutí a ověření', target) : fail('Design: ověření', `očekáváno ${target}, dostáno ${verify.data}`)

        await supabase.from('company_settings').update({ app_design: original }).eq('id', settings.id)
        pass('Design: obnovení původního', original)
      }
    }

    await supabase.auth.signOut()
    pass('Odhlášení')
  }
}

console.log('')
const failed = results.filter((r) => !r.ok)
if (failed.length === 0) {
  console.log(`=== VŠECHNO OK (${results.length} testů) ===`)
  process.exit(0)
}
console.log(`=== SELHALO ${failed.length}/${results.length} testů ===`)
for (const item of failed) console.error(`  - ${item.name}: ${item.detail}`)
process.exit(1)

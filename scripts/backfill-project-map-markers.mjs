#!/usr/bin/env node
/**
 * PDF 8 – doplnění chybějících hlavních špendlíků pro aktivní zakázky.
 * Vyžaduje SUPABASE_SERVICE_ROLE_KEY a VITE_SUPABASE_URL v .env.local
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

loadEnvFile('.env')
loadEnvFile('.env.local')

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('FAIL: Vyžaduje VITE_SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const { data: orders, error: ordersError } = await supabase
  .from('job_orders')
  .select('id, name, location, gps_lat, gps_lng, gps_accuracy, status')
  .eq('status', 'aktivni')

if (ordersError) {
  console.error('FAIL:', ordersError.message)
  process.exit(1)
}

const { data: markers, error: markersError } = await supabase
  .from('project_map_markers')
  .select('project_id')

if (markersError) {
  console.error('FAIL:', markersError.message)
  process.exit(1)
}

const markerProjects = new Set((markers ?? []).map((m) => m.project_id))
const missing = (orders ?? []).filter((o) => !markerProjects.has(o.id))

console.log(`Aktivní zakázky: ${orders?.length ?? 0}`)
console.log(`Bez špendlíku: ${missing.length}`)

let created = 0
for (const order of missing) {
  const { error } = await supabase.from('project_map_markers').insert({
    project_id: order.id,
    gps_lat: order.gps_lat,
    gps_lng: order.gps_lng,
    gps_accuracy: order.gps_accuracy,
    is_approximate: order.gps_lat == null || order.gps_lng == null,
    marker_color: 'green',
    color_source: 'auto',
    color_label: 'Nová zakázka',
  })
  if (error) {
    if (error.code === '23505') continue
    console.error(`Chyba u ${order.name}:`, error.message)
  } else {
    created += 1
    console.log(`Vytvořen špendlík: ${order.name}`)
  }
}

console.log(`Hotovo. Vytvořeno ${created} špendlíků.`)

#!/usr/bin/env node
/**
 * PDF 8 – doplnění chybějících hlavních špendlíků pro aktivní zakázky včetně geokódování.
 * Vyžaduje SUPABASE_SERVICE_ROLE_KEY a VITE_SUPABASE_URL v .env.local
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const GEOCODE_DELAY_MS = 1100

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

function buildGeocodeQuery(location) {
  const trimmed = location?.trim()
  if (!trimmed) return null
  if (/česko|czech/i.test(trimmed)) return trimmed
  return `${trimmed}, Česko`
}

async function geocode(query) {
  const url = new URL(NOMINATIM)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'cz')

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'VH-Bulldig-ERP/2.0 (backfill-script)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) return null
  const data = await response.json()
  const hit = data[0]
  if (!hit?.lat || !hit?.lon) return null
  return { lat: Number(hit.lat), lng: Number(hit.lon) }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

loadEnvFile('.env')
loadEnvFile('.env.local')
loadEnvFile('.env.production')

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
  .in('status', ['aktivni', 'pripravuje_se', 'pozastavena'])

if (ordersError) {
  console.error('FAIL:', ordersError.message)
  process.exit(1)
}

const { data: markers, error: markersError } = await supabase
  .from('project_map_markers')
  .select('project_id, gps_lat, gps_lng')

if (markersError) {
  console.error('FAIL:', markersError.message)
  process.exit(1)
}

const markerByProject = new Map((markers ?? []).map((m) => [m.project_id, m]))
const targets = (orders ?? []).filter((order) => {
  const marker = markerByProject.get(order.id)
  const hasOrderGps = order.gps_lat != null && order.gps_lng != null
  const hasMarkerGps = marker?.gps_lat != null && marker?.gps_lng != null
  return !hasOrderGps && !hasMarkerGps && buildGeocodeQuery(order.location)
})

console.log(`Zakázky k doplnění: ${targets.length}`)

let created = 0
let updated = 0
let geocoded = 0

for (let i = 0; i < targets.length; i++) {
  const order = targets[i]
  const query = buildGeocodeQuery(order.location)
  if (!query) continue

  process.stdout.write(`  ${order.name} (${order.location})… `)
  const coords = await geocode(query)

  let gps_lat = order.gps_lat
  let gps_lng = order.gps_lng
  let is_approximate = true

  if (coords) {
    gps_lat = coords.lat
    gps_lng = coords.lng
    is_approximate = true
    geocoded += 1
  }

  const marker = markerByProject.get(order.id)
  if (marker) {
    const { error } = await supabase
      .from('project_map_markers')
      .update({ gps_lat, gps_lng, gps_accuracy: null, is_approximate })
      .eq('project_id', order.id)
    if (error) console.error('UPDATE chyba:', error.message)
    else updated += 1
  } else {
    const { error } = await supabase.from('project_map_markers').insert({
      project_id: order.id,
      gps_lat,
      gps_lng,
      gps_accuracy: null,
      is_approximate,
      marker_color: 'green',
      color_source: 'auto',
      color_label: 'Nová zakázka',
    })
    if (error && error.code !== '23505') console.error('INSERT chyba:', error.message)
    else created += 1
  }

  if (coords) {
    await supabase
      .from('job_orders')
      .update({ gps_lat, gps_lng, gps_accuracy: null })
      .eq('id', order.id)
  }

  console.log(coords ? `OK (${gps_lat}, ${gps_lng})` : 'bez GPS')
  if (i < targets.length - 1) await delay(GEOCODE_DELAY_MS)
}

console.log(`Hotovo. Geokódováno: ${geocoded}, vytvořeno: ${created}, aktualizováno: ${updated}`)

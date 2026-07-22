#!/usr/bin/env node
/**
 * PDF 8 – backfill barev markerů v produkci.
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

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Chybí VITE_SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  console.log('Backfill barev markerů – start')

  const { data: autoMarkers, error } = await supabase
    .from('project_map_markers')
    .select('project_id, marker_color, color_label, color_source')
    .eq('color_source', 'auto')

  if (error) throw new Error(error.message)

  let redWithoutDiary = 0
  let recalculated = 0
  let skippedManual = 0

  for (const marker of autoMarkers ?? []) {
    const { count: diaryCount } = await supabase
      .from('construction_diary_entries')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', marker.project_id)

    if ((diaryCount ?? 0) === 0) {
      const { error: updateError } = await supabase
        .from('project_map_markers')
        .update({
          marker_color: 'red',
          color_label: 'Chybí stavební deník',
          color_source: 'auto',
        })
        .eq('project_id', marker.project_id)
        .eq('color_source', 'auto')

      if (updateError) throw new Error(updateError.message)
      redWithoutDiary += 1
      continue
    }

    const { error: rpcError } = await supabase.rpc('recalculate_project_marker_color', {
      p_project_id: marker.project_id,
    })

    if (rpcError) {
      console.warn(`RPC selhalo pro ${marker.project_id}:`, rpcError.message)
    } else {
      recalculated += 1
    }
  }

  const { count: manualCount } = await supabase
    .from('project_map_markers')
    .select('id', { count: 'exact', head: true })
    .eq('color_source', 'manual')

  skippedManual = manualCount ?? 0

  console.log('Backfill dokončen:')
  console.log(`  Bez deníku → červená: ${redWithoutDiary}`)
  console.log(`  S deníkem → přepočet RPC: ${recalculated}`)
  console.log(`  Ruční override ponecháno: ${skippedManual}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

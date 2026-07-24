#!/usr/bin/env node
/**
 * PDF 8 Fáze 1j – ověření modulu Zakázky a mapa.
 * Spuštění: npm run verify:pdf8
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const migrationsDir = resolve(root, 'supabase/migrations')
const requiredMigrations = [
  '068_pdf8_project_map_module.sql',
  '069_pdf8_marker_optional_gps.sql',
  '070_pdf8_manual_marker_color_majitel.sql',
  '071_pdf8_stavbyvedouci_assignments_rls.sql',
  '072_pdf8_stavbyvedouci_workers_rpc.sql',
  '073_pdf8_diary_missing_notifications.sql',
  '074_pdf8_phase_1j_finalize.sql',
]

const requiredTables = [
  'project_map_markers',
  'project_user_assignments',
  'project_notifications',
  'project_marker_status_history',
]

const requiredFunctions = [
  'is_assigned_to_project',
  'run_missing_diary_check',
  'recalculate_project_marker_color',
  'resolve_missing_diary_notifications',
  'list_workers_for_assigned_order',
]

let failed = 0

function pass(message) {
  console.log(`OK: ${message}`)
}

function fail(message) {
  console.error(`FAIL: ${message}`)
  failed += 1
}

console.log('=== PDF 8 – verify zakazky-mapa ===\n')

for (const file of requiredMigrations) {
  const path = resolve(migrationsDir, file)
  if (existsSync(path)) {
    pass(`Migrace ${file}`)
  } else {
    fail(`Chybí migrace ${file}`)
  }
}

const applyAll = resolve(root, 'supabase/apply-all-migrations.sql')
if (existsSync(applyAll)) {
  const sql = readFileSync(applyAll, 'utf8')
  for (const table of requiredTables) {
    if (sql.includes(`CREATE TABLE ${table}`) || sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
      pass(`Tabulka ${table} v apply-all-migrations.sql`)
    } else {
      fail(`Tabulka ${table} chybí v apply-all-migrations.sql`)
    }
  }
  for (const fn of requiredFunctions) {
    if (sql.includes(fn)) {
      pass(`Funkce ${fn} v apply-all-migrations.sql`)
    } else {
      fail(`Funkce ${fn} chybí v apply-all-migrations.sql`)
    }
  }
  if (!sql.includes('CREATE TABLE projects')) {
    pass('Neexistuje duplicitní tabulka projects')
  }
  if (sql.includes('UNIQUE(project_id)') || sql.includes('project_map_markers_project_id_key')) {
    pass('Unikátní omezení na project_map_markers.project_id')
  }
  if (sql.includes('idx_project_notifications_dedup')) {
    pass('Unikátní index proti duplicitám upozornění')
  }
} else {
  fail('Chybí supabase/apply-all-migrations.sql – spusťte npm run build-apply-all-sql')
}

const srcFiles = [
  'src/pages/zakazkyMapa/ZakazkyMapaPage.tsx',
  'src/pages/stavbyvedouci/StavbyvedouciHubPage.tsx',
  'src/lib/zakazkyMapa/computeMarkerColor.ts',
  'src/lib/zakazkyMapa/diaryMissingCheck.ts',
  'src/lib/zakazkyMapa/notificationsApi.ts',
  'src/constants/stavbyvedouciNavigation.ts',
  'docs/PDF8_ZAKAZKY_MAPA.md',
]

for (const rel of srcFiles) {
  if (existsSync(resolve(root, rel))) {
    pass(`Soubor ${rel}`)
  } else {
    fail(`Chybí ${rel}`)
  }
}

console.log('\n=== Unit testy modulu ===\n')
try {
  execSync(
    'npx vitest run src/lib/zakazkyMapa src/constants/permissions.stavbyvedouci.test.ts src/constants/permissions.majitel.test.ts src/lib/zakazkyMapa/projectAssignmentRules.test.ts',
    { stdio: 'inherit', cwd: root }
  )
  pass('Unit testy modulu prošly')
} catch {
  fail('Unit testy modulu selhaly')
}

console.log(`\n=== Výsledek: ${failed === 0 ? 'PASS' : `${failed} chyb`} ===`)
process.exit(failed === 0 ? 0 : 1)

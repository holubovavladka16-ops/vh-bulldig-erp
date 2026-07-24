import {
  getSupabaseConfigHint,
  getSupabaseUrl,
  isSupabaseConfigured,
} from '@/lib/env'
import { supabase } from '@/lib/supabase'

export type HealthSeverity = 'critical' | 'warning'

export interface HealthIssue {
  id: string
  severity: HealthSeverity
  title: string
  message: string
  fix: string
}

export interface SystemHealthReport {
  ok: boolean
  checkedAt: string
  environment: 'production' | 'development'
  supabaseConfigured: boolean
  supabaseReachable: boolean
  migrationsApplied: boolean
  bootstrapNeeded: boolean | null
  adminReady: boolean
  coreTablesOk: boolean
  issues: HealthIssue[]
}

const CORE_TABLES = [
  'profiles',
  'workers',
  'job_orders',
  'company_settings',
  'worker_daily_forms',
] as const

function issue(
  id: string,
  severity: HealthSeverity,
  title: string,
  message: string,
  fix: string
): HealthIssue {
  return { id, severity, title, message, fix }
}

async function checkSupabaseReachable(): Promise<boolean> {
  const url = getSupabaseUrl()
  if (!url) return false
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '' },
    })
    return response.ok || response.status === 404 || response.status === 401
  } catch {
    return false
  }
}

async function checkCoreTables(): Promise<{ ok: boolean; missing: string[] }> {
  const missing: string[] = []
  for (const table of CORE_TABLES) {
    const { error } = await supabase.from(table).select('*').limit(0)
    if (
      error &&
      (error.code === 'PGRST205' ||
        error.message.includes('schema cache') ||
        error.message.includes('does not exist'))
    ) {
      missing.push(table)
    }
  }
  return { ok: missing.length === 0, missing }
}

async function checkBootstrapState(): Promise<{
  migrationsApplied: boolean
  bootstrapNeeded: boolean | null
}> {
  const { data, error } = await supabase.rpc('system_needs_bootstrap')
  if (error) {
    if (
      error.code === 'PGRST202' ||
      error.message.includes('system_needs_bootstrap') ||
      error.message.includes('schema cache')
    ) {
      return { migrationsApplied: false, bootstrapNeeded: null }
    }
    throw new Error(error.message)
  }
  return { migrationsApplied: true, bootstrapNeeded: Boolean(data) }
}

export async function runSystemHealthCheck(): Promise<SystemHealthReport> {
  const issues: HealthIssue[] = []
  const environment = import.meta.env.PROD ? 'production' : 'development'
  const supabaseConfigured = isSupabaseConfigured()

  if (!supabaseConfigured) {
    issues.push(
      issue(
        'env-missing',
        'critical',
        'Chybí Supabase konfigurace',
        'Aplikace nemá nastavené VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY.',
        getSupabaseConfigHint()
      )
    )
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      environment,
      supabaseConfigured: false,
      supabaseReachable: false,
      migrationsApplied: false,
      bootstrapNeeded: null,
      adminReady: false,
      coreTablesOk: false,
      issues,
    }
  }

  const supabaseReachable = await checkSupabaseReachable()
  if (!supabaseReachable) {
    issues.push(
      issue(
        'supabase-unreachable',
        'critical',
        'Supabase není dostupný',
        'Server neodpovídá na adrese z VITE_SUPABASE_URL.',
        'Zkontrolujte internet, URL projektu v Supabase Dashboard a stav projektu (případně restart v Settings → General).'
      )
    )
  }

  let migrationsApplied = false
  let bootstrapNeeded: boolean | null = null

  if (supabaseReachable) {
    try {
      const bootstrap = await checkBootstrapState()
      migrationsApplied = bootstrap.migrationsApplied
      bootstrapNeeded = bootstrap.bootstrapNeeded
    } catch (err) {
      issues.push(
        issue(
          'bootstrap-check-failed',
          'critical',
          'Kontrola databáze selhala',
          err instanceof Error ? err.message : 'Neznámá chyba',
          'Ověřte Supabase projekt a spusťte npm run setup-complete.'
        )
      )
    }
  }

  if (supabaseReachable && !migrationsApplied) {
    issues.push(
      issue(
        'migrations-missing',
        'critical',
        'Databáze není inicializovaná',
        'Chybí ERP schéma (migrace). RPC system_needs_bootstrap není k dispozici.',
        'Spusťte npm run setup-complete s SUPABASE_DB_PASSWORD nebo SUPABASE_ACCESS_TOKEN v .env.local, nebo vložte SQL z supabase/apply-all-migrations.sql do Supabase SQL Editoru.'
      )
    )
  }

  let coreTablesOk = false
  if (supabaseReachable && migrationsApplied) {
    const tables = await checkCoreTables()
    coreTablesOk = tables.ok
    if (!tables.ok) {
      issues.push(
        issue(
          'tables-missing',
          'critical',
          'Chybí klíčové tabulky',
          `V databázi chybí: ${tables.missing.join(', ')}`,
          'Doplňte migrace: npm run setup-complete nebo npm run apply-migrations-pg.'
        )
      )
    }
  }

  const adminReady = migrationsApplied && bootstrapNeeded === false
  if (migrationsApplied && bootstrapNeeded === true) {
    issues.push(
      issue(
        'admin-missing',
        'warning',
        'Administrátor neexistuje',
        'Databáze je připravená, ale chybí první administrátor.',
        'Dokončete první spuštění formulářem na přihlašovací stránce nebo spusťte npm run setup-complete.'
      )
    )
  }

  const hasCritical = issues.some((i) => i.severity === 'critical')

  return {
    ok: !hasCritical && supabaseConfigured && supabaseReachable && migrationsApplied && coreTablesOk,
    checkedAt: new Date().toISOString(),
    environment,
    supabaseConfigured,
    supabaseReachable,
    migrationsApplied,
    bootstrapNeeded,
    adminReady,
    coreTablesOk,
    issues,
  }
}

export function getPrimaryHealthIssue(report: SystemHealthReport): HealthIssue | null {
  return (
    report.issues.find((i) => i.severity === 'critical') ??
    report.issues[0] ??
    null
  )
}

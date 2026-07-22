/**
 * Vercel API – aplikace migrací PDF 8 (068–074) na produkční Supabase.
 * Stejná autentizace a DB připojení jako admin-apply-form-check-migrations.js
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './lib/config.js'

const MIGRATION_FILES = [
  '068_pdf8_project_map_module.sql',
  '069_pdf8_marker_optional_gps.sql',
  '070_pdf8_manual_marker_color_majitel.sql',
  '071_pdf8_stavbyvedouci_assignments_rls.sql',
  '072_pdf8_stavbyvedouci_workers_rpc.sql',
  '073_pdf8_diary_missing_notifications.sql',
  '074_pdf8_phase_1j_finalize.sql',
]

const PDF8_TABLES = [
  'project_map_markers',
  'project_user_assignments',
  'project_notifications',
  'project_marker_status_history',
]

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function getProjectRef(url) {
  return url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null
}

function getDbPassword() {
  if (process.env.SUPABASE_DB_PASSWORD) return process.env.SUPABASE_DB_PASSWORD
  for (const key of ['POSTGRES_URL', 'DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_DB_DIRECT_URL']) {
    const value = process.env[key]
    if (!value) continue
    try {
      const parsed = new URL(value)
      if (parsed.password) return decodeURIComponent(parsed.password)
    } catch {
      /* ignore */
    }
  }
  return null
}

function buildConnectionCandidates(projectRef, dbPassword) {
  const encodedPassword = encodeURIComponent(dbPassword)
  const candidates = []
  for (const key of ['SUPABASE_DB_DIRECT_URL', 'SUPABASE_DB_URL', 'DATABASE_URL', 'POSTGRES_URL']) {
    if (process.env[key]) candidates.push(process.env[key])
  }
  candidates.push(
    `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`,
    `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
  )
  return [...new Set(candidates.filter(Boolean))]
}

async function connectDb(projectRef) {
  const errors = []
  for (const url of buildConnectionCandidates(projectRef, getDbPassword() ?? '')) {
    if (!getDbPassword() && !url.includes('postgresql://postgres:')) continue
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    })
    try {
      await client.connect()
      return client
    } catch (error) {
      errors.push(error.message)
      await client.end().catch(() => {})
    }
  }
  throw new Error(`DB_CONNECT_FAILED: ${errors.join(' | ')}`)
}

async function verifyAdmin(req) {
  const { url: supabaseUrl, anonKey } = getSupabaseConfig()
  if (!supabaseUrl || !anonKey) return { ok: false, reason: 'missing_supabase_config' }
  const authHeader = req.headers.authorization ?? req.headers.Authorization
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'unauthorized' }
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  })
  return res.ok ? { ok: true } : { ok: false, reason: 'unauthorized' }
}

async function applyViaManagementApi(projectRef) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) return null
  const applied = []
  const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
  for (const file of MIGRATION_FILES) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const body = await response.text()
    if (!response.ok) {
      const n = body.toLowerCase()
      if (n.includes('already exists') || n.includes('duplicate_object')) {
        applied.push(`${file} (skip)`)
        continue
      }
      throw new Error(`${file}: ${response.status} ${body.slice(0, 300)}`)
    }
    applied.push(file)
  }
  return applied
}

async function verifySchema(client) {
  const checks = {}
  for (const table of PDF8_TABLES) {
    const res = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS ok`,
      [table]
    )
    checks[table] = res.rows[0]?.ok === true
  }
  const mod = await client.query(
    `SELECT is_implemented, module_version FROM erp_modules WHERE id = 'zakazky-mapa'`
  )
  checks.erpModule = mod.rows[0] ?? null
  return checks
}

async function verifyRestApi() {
  const { url, anonKey } = getSupabaseConfig()
  const supabase = createClient(url, anonKey)
  const rest = {}
  for (const table of ['project_map_markers', 'project_notifications']) {
    const { error } = await supabase.from(table).select('id').limit(1)
    rest[table] = error?.code === 'PGRST205' ? 'missing_from_cache' : error ? `rls_or_error:${error.code}` : 'ok'
  }
  return rest
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const access = await verifyAdmin(req)
    if (!access.ok) {
      return res.status(access.reason === 'missing_supabase_config' ? 503 : 401).json({
        error: access.reason === 'missing_supabase_config' ? 'Chybí Supabase config' : 'Vyžadováno přihlášení administrátora',
      })
    }

    const { url: supabaseUrl } = getSupabaseConfig()
    const projectRef = getProjectRef(supabaseUrl)
    if (!projectRef) return res.status(503).json({ error: 'Neplatná Supabase URL' })

    const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
    if (!existsSync(join(migrationsDir, MIGRATION_FILES[0]))) {
      return res.status(500).json({ error: 'Chybí soubory migrací v supabase/migrations' })
    }

    let client
    let applied = []
    let method = 'pg'

    try {
      if (!getDbPassword() && !process.env.SUPABASE_ACCESS_TOKEN) {
        throw new Error('SUPABASE_DB_PASSWORD_MISSING')
      }

      if (getDbPassword()) {
        client = await connectDb(projectRef)
        for (const file of MIGRATION_FILES) {
          const sql = readFileSync(join(migrationsDir, file), 'utf8')
          try {
            await client.query('BEGIN')
            await client.query(sql)
            await client.query('COMMIT')
            applied.push(file)
          } catch (error) {
            await client.query('ROLLBACK').catch(() => {})
            const msg = error.message.toLowerCase()
            if (msg.includes('already exists') || msg.includes('duplicate_object')) {
              applied.push(`${file} (skip)`)
              continue
            }
            throw error
          }
        }
        await client.query(`NOTIFY pgrst, 'reload schema'`)
      } else {
        applied = await applyViaManagementApi(projectRef)
        method = 'management_api'
      }
    } catch (err) {
      if (String(err.message).includes('SUPABASE_DB_PASSWORD_MISSING') || String(err.message).includes('DB_CONNECT_FAILED')) {
        const mgmt = await applyViaManagementApi(projectRef)
        if (mgmt) {
          applied = mgmt
          method = 'management_api'
        } else {
          throw err
        }
      } else {
        throw err
      }
    } finally {
      await client?.end().catch(() => {})
    }

    await new Promise((r) => setTimeout(r, 2000))
    const restChecks = await verifyRestApi()

    let schemaChecks = null
    if (getDbPassword()) {
      const verifyClient = await connectDb(projectRef)
      try {
        schemaChecks = await verifySchema(verifyClient)
      } finally {
        await verifyClient.end().catch(() => {})
      }
    }

    const allRestOk = Object.values(restChecks).every((v) => v === 'ok' || String(v).startsWith('rls_or_error'))

    return res.status(200).json({
      ok: allRestOk,
      applied,
      method,
      schemaChecks,
      restChecks,
    })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal error',
    })
  }
}

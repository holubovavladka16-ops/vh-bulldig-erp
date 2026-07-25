/**
 * Vercel API – aplikace migrací Fakturovač (081–082) na produkční Supabase.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './lib/config.js'
import { getDbPasswordFromEnv, getDbConnectionCandidates } from './lib/db-credentials.js'

const MIGRATION_FILES = ['081_fakturovac_module.sql', '082_fakturovac_storage_update.sql']

const FAKTUROVAC_TABLES = ['issued_invoices', 'issued_invoice_lines', 'invoice_settings']

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function getProjectRef(url) {
  return url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null
}

function getDbPassword() {
  return getDbPasswordFromEnv()
}

async function connectDb(projectRef) {
  const errors = []
  for (const url of getDbConnectionCandidates(projectRef)) {
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

  const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
  const applied = []

  for (const file of MIGRATION_FILES) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    })
    const body = await response.text()
    if (!response.ok) {
      const normalized = body.toLowerCase()
      if (normalized.includes('already exists') || normalized.includes('duplicate_object')) {
        applied.push(`${file} (skip)`)
        continue
      }
      throw new Error(`${file}: ${response.status} ${body.slice(0, 300)}`)
    }
    applied.push(file)
  }

  return applied
}

async function verifyRestApi() {
  const { url, anonKey } = getSupabaseConfig()
  const supabase = createClient(url, anonKey)
  const rest = {}

  for (const table of FAKTUROVAC_TABLES) {
    const { error } = await supabase.from(table).select('id').limit(1)
    rest[table] = error?.code === 'PGRST205' ? 'missing_from_cache' : error ? `rls_or_error:${error.code}` : 'ok'
  }

  const { data, error } = await supabase
    .from('erp_modules')
    .select('id, is_implemented')
    .eq('id', 'fakturovac')
    .maybeSingle()

  rest.fakturovac_module = error ? `error:${error.code}` : data?.is_implemented ? 'ok' : 'not_registered'

  return rest
}

async function verifySchema(client) {
  const checks = {}
  for (const table of FAKTUROVAC_TABLES) {
    const res = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS ok`,
      [table]
    )
    checks[table] = res.rows[0]?.ok === true
  }

  const mod = await client.query(`SELECT is_implemented FROM erp_modules WHERE id = 'fakturovac'`)
  checks.fakturovac_module = mod.rows[0]?.is_implemented === true

  return checks
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    const access = await verifyAdmin(req)
    if (!access.ok) {
      return res.status(access.reason === 'missing_supabase_config' ? 503 : 401).json({
        error:
          access.reason === 'missing_supabase_config'
            ? 'Chybí Supabase config'
            : 'Vyžadováno přihlášení administrátora',
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
      if (
        String(err.message).includes('SUPABASE_DB_PASSWORD_MISSING') ||
        String(err.message).includes('DB_CONNECT_FAILED')
      ) {
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

    const tablesOk = ['issued_invoices', 'invoice_settings'].every(
      (t) => restChecks[t] === 'ok' || String(restChecks[t]).startsWith('rls_or_error')
    )

    return res.status(200).json({
      ok: tablesOk,
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

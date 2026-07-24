/**
 * Vercel API – seed ceníku položek pro Fakturační výkaz prací (migrace 088).
 * Funguje i bez SUPABASE_DB_PASSWORD: vkládá položky přes REST s JWT administrátora.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './lib/config.js'
import { getDbPasswordFromEnv, getDbConnectionCandidates } from './lib/db-credentials.js'
import { INVOICEABLE_SEED_ITEMS, INVOICEABLE_SEED_EXPECTED_COUNT } from './lib/invoiceable-items-seed-data.js'

const MIGRATION_FILE = '088_invoiceable_items_seed.sql'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function getProjectRef(url) {
  return url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null
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
  if (!res.ok) return { ok: false, reason: 'unauthorized' }
  return { ok: true, authHeader }
}

async function applyViaManagementApi(projectRef) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) return null

  const sql = readFileSync(join(resolve(process.cwd(), 'supabase/migrations'), MIGRATION_FILE), 'utf8')
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`${MIGRATION_FILE}: ${response.status} ${body.slice(0, 300)}`)
  return 'management_api'
}

async function applyViaRest(authHeader) {
  const { url, anonKey } = getSupabaseConfig()
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  let inserted = 0
  let skipped = 0
  const errors = []

  for (const item of INVOICEABLE_SEED_ITEMS) {
    const { error } = await supabase.from('invoiceable_items').insert(item)
    if (error) {
      if (error.code === '23505') {
        skipped += 1
        continue
      }
      errors.push(`${item.name}: ${error.message}`)
    } else {
      inserted += 1
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.slice(0, 3).join(' | '))
  }

  return { inserted, skipped, method: 'rest_admin_jwt' }
}

async function countActiveItems(authHeader) {
  const { url, anonKey } = getSupabaseConfig()
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { count, error } = await supabase
    .from('invoiceable_items')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (error) throw new Error(error.message)
  return count ?? 0
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
            : 'Vyžadováno přihlášení administrátora nebo majitele',
      })
    }

    const { url: supabaseUrl } = getSupabaseConfig()
    const projectRef = getProjectRef(supabaseUrl)
    if (!projectRef) return res.status(503).json({ error: 'Neplatná Supabase URL' })

    const migrationPath = join(resolve(process.cwd(), 'supabase/migrations'), MIGRATION_FILE)
    if (!existsSync(migrationPath)) {
      return res.status(500).json({ error: 'Chybí soubor migrace 088' })
    }

    let method = 'rest_admin_jwt'
    let insertStats = null

    if (getDbPasswordFromEnv()) {
      let client
      try {
        client = await connectDb(projectRef)
        const sql = readFileSync(migrationPath, 'utf8')
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('COMMIT')
        method = 'pg'
      } catch (error) {
        await client?.query('ROLLBACK').catch(() => {})
        const mgmt = await applyViaManagementApi(projectRef)
        if (mgmt) {
          method = mgmt
        } else {
          insertStats = await applyViaRest(access.authHeader)
          method = insertStats.method
        }
      } finally {
        await client?.end().catch(() => {})
      }
    } else if (process.env.SUPABASE_ACCESS_TOKEN) {
      method = await applyViaManagementApi(projectRef)
    } else {
      insertStats = await applyViaRest(access.authHeader)
      method = insertStats.method
    }

    const activeCount = await countActiveItems(access.authHeader)

    return res.status(200).json({
      ok: activeCount >= INVOICEABLE_SEED_EXPECTED_COUNT,
      method,
      insertStats,
      activeCount,
      expectedCount: INVOICEABLE_SEED_EXPECTED_COUNT,
    })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal error',
    })
  }
}

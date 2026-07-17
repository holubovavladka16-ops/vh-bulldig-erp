import pg from 'pg'
import { getSupabaseConfig } from './lib/config.js'

const MIGRATION_060 = `
DO $$ BEGIN
  CREATE TYPE form_check_outcome AS ENUM ('match', 'mismatch', 'manual_review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS form_check_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES paper_monthly_forms(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL CHECK (year >= 2020),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome form_check_outcome NOT NULL,
  difference_count INTEGER NOT NULL DEFAULT 0,
  ocr_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  comparison_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_path TEXT,
  checked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_check_records_form ON form_check_records(form_id);
CREATE INDEX IF NOT EXISTS idx_form_check_records_worker_period ON form_check_records(worker_id, year, month);
CREATE INDEX IF NOT EXISTS idx_form_check_records_checked_at ON form_check_records(checked_at DESC);

ALTER TABLE form_check_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin čte záznamy kontroly formuláře"
    ON form_check_records FOR SELECT
    USING (get_user_role() = 'administrator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin zapisuje záznamy kontroly formuláře"
    ON form_check_records FOR INSERT
    WITH CHECK (get_user_role() = 'administrator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT ON form_check_records TO authenticated;

NOTIFY pgrst, 'reload schema';
`

const MIGRATION_061 = `
ALTER TABLE form_check_records
  ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS form_number TEXT;

CREATE INDEX IF NOT EXISTS idx_form_check_records_outcome ON form_check_records(outcome);
CREATE INDEX IF NOT EXISTS idx_form_check_records_checked_by ON form_check_records(checked_by);

NOTIFY pgrst, 'reload schema';
`

const MIGRATIONS = [
  { name: '060_form_check_records.sql', sql: MIGRATION_060 },
  { name: '061_form_check_phase5.sql', sql: MIGRATION_061 },
]

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
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

function getProjectRef(url) {
  return url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null
}

function buildConnectionCandidates(projectRef, dbPassword) {
  const encodedPassword = encodeURIComponent(dbPassword)
  const candidates = []

  for (const key of ['SUPABASE_DB_DIRECT_URL', 'SUPABASE_DB_URL', 'DATABASE_URL', 'POSTGRES_URL']) {
    if (process.env[key]) candidates.push(process.env[key])
  }

  candidates.push(
    `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`,
    `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
  )

  return [...new Set(candidates.filter(Boolean))]
}

async function connectDb(projectRef) {
  const dbPassword = process.env.SUPABASE_DB_PASSWORD
  if (!dbPassword) {
    throw new Error('SUPABASE_DB_PASSWORD_MISSING')
  }

  const errors = []
  for (const url of buildConnectionCandidates(projectRef, dbPassword)) {
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
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

async function tableColumns(client) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'form_check_records'
    ORDER BY ordinal_position
  `)
  return result.rows.map((r) => r.column_name)
}

export default async function handler(req, res) {
  setCors(res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Povolena je pouze metoda POST' })

  try {
    const access = await verifyAdmin(req)
    if (!access.ok) {
      if (access.reason === 'missing_supabase_config') {
        return res.status(503).json({ error: 'Chybí konfigurace Supabase na serveru.' })
      }
      return res.status(401).json({ error: 'Vyžadováno přihlášení administrátora.' })
    }

    const { url: supabaseUrl } = getSupabaseConfig()
    const projectRef = getProjectRef(supabaseUrl)
    if (!projectRef) {
      return res.status(503).json({ error: 'Neplatná konfigurace Supabase URL.' })
    }

    const client = await connectDb(projectRef)
    const applied = []

    try {
      const existingColumns = await tableColumns(client)
      if (existingColumns.includes('ocr_confidence') && existingColumns.includes('form_number')) {
        return res.status(200).json({
          ok: true,
          alreadyApplied: true,
          columns: existingColumns,
        })
      }

      for (const migration of MIGRATIONS) {
        await client.query('BEGIN')
        try {
          await client.query(migration.sql)
          await client.query('COMMIT')
          applied.push(migration.name)
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {})
          const message = error.message.toLowerCase()
          if (message.includes('already exists') || message.includes('duplicate_object')) {
            applied.push(`${migration.name} (skip)`)
            continue
          }
          throw error
        }
      }

      const columns = await tableColumns(client)
      return res.status(200).json({ ok: true, applied, columns })
    } finally {
      await client.end().catch(() => {})
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    if (message === 'SUPABASE_DB_PASSWORD_MISSING') {
      return res.status(503).json({
        error: 'Na Vercelu chybí SUPABASE_DB_PASSWORD. Nastavte ho v Environment Variables projektu.',
      })
    }
    return res.status(500).json({ error: message })
  }
}

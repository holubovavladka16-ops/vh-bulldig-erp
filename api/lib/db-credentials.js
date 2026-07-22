/** Detekce DB credentials z Vercel / Supabase integrace (bez vypisování hodnot). */
const URL_ENV_KEYS = [
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL',
  'SUPABASE_DB_URL',
  'SUPABASE_DB_DIRECT_URL',
]

const PASSWORD_ENV_KEYS = ['SUPABASE_DB_PASSWORD', 'POSTGRES_PASSWORD', 'PGPASSWORD']

export function getDbPasswordFromEnv() {
  for (const key of PASSWORD_ENV_KEYS) {
    const value = process.env[key]
    if (value) return value
  }

  for (const key of URL_ENV_KEYS) {
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

export function getDbConnectionCandidates(projectRef) {
  const dbPassword = getDbPasswordFromEnv()
  const candidates = []

  for (const key of URL_ENV_KEYS) {
    if (process.env[key]) candidates.push(process.env[key])
  }

  if (dbPassword) {
    const encodedPassword = encodeURIComponent(dbPassword)
    candidates.push(
      `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`,
      `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
      `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
    )
  }

  return [...new Set(candidates.filter(Boolean))]
}

export function getDbCredentialFlags() {
  const flags = {
    hasDbPassword: false,
    hasPostgresUrl: false,
    hasDatabaseUrl: false,
    hasAccessToken: Boolean(process.env.SUPABASE_ACCESS_TOKEN),
    hasPostgresPassword: false,
    hasPostgresNonPooling: false,
    hasPostgresPrismaUrl: false,
    hasSupabaseDbUrl: false,
  }

  for (const key of PASSWORD_ENV_KEYS) {
    if (process.env[key]) flags.hasDbPassword = true
  }
  if (process.env.POSTGRES_PASSWORD) flags.hasPostgresPassword = true
  if (process.env.POSTGRES_URL) flags.hasPostgresUrl = true
  if (process.env.POSTGRES_URL_NON_POOLING) flags.hasPostgresNonPooling = true
  if (process.env.POSTGRES_PRISMA_URL) flags.hasPostgresPrismaUrl = true
  if (process.env.DATABASE_URL) flags.hasDatabaseUrl = true
  if (process.env.SUPABASE_DB_URL || process.env.SUPABASE_DB_DIRECT_URL) {
    flags.hasSupabaseDbUrl = true
  }

  return flags
}

export function listDbRelatedEnvKeys() {
  return Object.keys(process.env)
    .filter((k) => /SUPABASE|POSTGRES|DATABASE|DB_|PG/i.test(k))
    .sort()
}

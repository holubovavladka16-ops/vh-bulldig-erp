import pg from 'pg'

const POOLER_REGIONS = [
  'eu-west-1',
  'eu-central-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'us-east-1',
  'us-west-1',
  'ap-southeast-1',
]

const POOLER_HOST_PREFIXES = ['aws-0', 'aws-1']

export function getProjectRef(supabaseUrl) {
  return supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null
}

function buildConnectionCandidates(projectRef, dbPassword) {
  const encodedPassword = encodeURIComponent(dbPassword)
  const candidates = []

  if (process.env.SUPABASE_DB_URL) {
    candidates.push({ label: 'SUPABASE_DB_URL', url: process.env.SUPABASE_DB_URL })
  }

  candidates.push({
    label: 'direct-postgres',
    url: `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`,
  })

  candidates.push({
    label: 'direct-project-user',
    url: `postgresql://postgres.${projectRef}:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`,
  })

  const regions = process.env.SUPABASE_DB_REGION
    ? [process.env.SUPABASE_DB_REGION, ...POOLER_REGIONS.filter((r) => r !== process.env.SUPABASE_DB_REGION)]
    : POOLER_REGIONS

  for (const hostPrefix of POOLER_HOST_PREFIXES) {
    for (const region of regions) {
      candidates.push({
        label: `${hostPrefix}-${region}-session`,
        url: `postgresql://postgres.${projectRef}:${encodedPassword}@${hostPrefix}-${region}.pooler.supabase.com:5432/postgres`,
      })
      candidates.push({
        label: `${hostPrefix}-${region}-transaction`,
        url: `postgresql://postgres.${projectRef}:${encodedPassword}@${hostPrefix}-${region}.pooler.supabase.com:6543/postgres`,
      })
    }
  }

  return candidates
}

export async function connectSupabaseDb({ projectRef, dbPassword }) {
  const candidates = buildConnectionCandidates(projectRef, dbPassword)
  const errors = []

  for (const candidate of candidates) {
    const client = new pg.Client({
      connectionString: candidate.url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    })

    try {
      await client.connect()
      return { client, label: candidate.label }
    } catch (error) {
      errors.push(`${candidate.label}: ${error.message}`)
      await client.end().catch(() => {})
    }
  }

  throw new Error(`Nepodařilo se připojit k databázi:\n${errors.join('\n')}`)
}

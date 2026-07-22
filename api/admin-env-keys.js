import { getSupabaseConfig } from './lib/config.js'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  const keys = Object.keys(process.env).filter((k) =>
    /SUPABASE|POSTGRES|DATABASE|VERCEL|DB_/i.test(k)
  ).sort()

  const { url, anonKey } = getSupabaseConfig()

  return res.status(200).json({
    envKeys: keys,
    hasDbPassword: Boolean(process.env.SUPABASE_DB_PASSWORD),
    hasAccessToken: Boolean(process.env.SUPABASE_ACCESS_TOKEN),
    hasPostgresUrl: Boolean(process.env.POSTGRES_URL),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    supabaseUrl: url ?? null,
    hasAnonKey: Boolean(anonKey),
  })
}

import { getSupabaseConfig } from './lib/config.js'
import { getDbCredentialFlags, listDbRelatedEnvKeys } from './lib/db-credentials.js'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  const { url, anonKey } = getSupabaseConfig()
  return res.status(200).json({
    supabaseUrl: url ?? null,
    hasAnonKey: Boolean(anonKey),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    envKeys: listDbRelatedEnvKeys(),
    ...getDbCredentialFlags(),
  })
}

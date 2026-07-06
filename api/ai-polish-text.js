const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token',
}

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

const PROMPTS = {
  diary: `Jsi odborník na stavební deníky. Přepiš následující text do profesionální podoby vhodné pro stavební deník.
Oprav pravopis, gramatiku, diakritiku a stylistiku. Používej správnou stavební terminologii.
Zachovej všechny skutečné informace, nic nevymýšlej ani nepřidávej.
Výstup napiš spisovnou češtinou. Vrať pouze upravený text bez úvodu, komentáře a bez uvozovek.`,
  daily_form: `Jsi odborník na denní výkazy stavebních dělníků. Přepiš následující text do profesionální češtiny.
Oprav pravopis, gramatiku, diakritiku a stylistiku. Používej správnou stavební terminologii.
Zachovej všechny skutečné informace, nic nevymýšlej ani nepřidávej.
Výstup napiš spisovnou češtinou. Vrať pouze upravený text bez úvodu, komentáře a bez uvozovek.`,
}

function setCors(res) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value)
  }
}

async function verifyAccess(req) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return { ok: false, reason: 'missing_supabase_config' }
  }

  const authHeader = req.headers.authorization ?? req.headers.Authorization
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
      },
    })
    if (res.ok) return { ok: true }
  }

  const portalToken = req.headers['x-portal-token'] ?? req.headers['X-Portal-Token']
  if (typeof portalToken === 'string' && portalToken) {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/portal_get_worker`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: portalToken }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === 'object') return { ok: true }
    }
  }

  return { ok: false, reason: 'unauthorized' }
}

async function polishWithGemini(roughText, context) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING')
  }

  const prompt = PROMPTS[context] ?? PROMPTS.daily_form
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt }] },
        contents: [{ role: 'user', parts: [{ text: roughText }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
      signal: controller.signal,
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data?.error?.message ?? `Gemini HTTP ${res.status}`
      throw new Error(msg)
    }

    const polished = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!polished) {
      throw new Error('Gemini nevrátil žádný text')
    }

    return polished.replace(/^["'„«]+|["'»]+$/g, '').trim()
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req, res) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Povolena je pouze metoda POST' })
  }

  try {
    const access = await verifyAccess(req)
    if (!access.ok) {
      return res.status(401).json({ error: 'Pro použití AI asistenta se musíte přihlásit.' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const roughText = String(body?.rough_text ?? '').trim()
    const context = body?.context === 'diary' ? 'diary' : 'daily_form'

    if (roughText.length < 8) {
      return res.status(400).json({ error: 'Napište alespoň krátký popis práce pro úpravu AI.' })
    }

    if (roughText.length > 8000) {
      return res.status(400).json({ error: 'Text je příliš dlouhý (max. 8000 znaků).' })
    }

    const polished_text = await polishWithGemini(roughText, context)

    return res.status(200).json({ polished_text, ai_assisted: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'

    if (message === 'GEMINI_API_KEY_MISSING') {
      return res.status(503).json({
        error: 'AI asistent není dostupný. Chybí konfigurace GEMINI_API_KEY.',
      })
    }

    if (message.includes('abort') || message.includes('AbortError')) {
      return res.status(504).json({
        error: 'AI asistent neodpověděl včas. Zkuste to prosím znovu.',
      })
    }

    return res.status(500).json({
      error: 'Oprava textu pomocí AI se nezdařila. Zkuste to později nebo text upravte ručně.',
    })
  }
}

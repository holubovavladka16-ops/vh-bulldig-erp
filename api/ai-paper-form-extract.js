import { getGeminiApiKey, getSupabaseConfig } from './lib/config.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

const SYSTEM_PROMPT = `Jsi expert na OCR ručně psaných stavebních měsíčních výkazů VH Bulldig ERP v češtině.
Analyzuj fotografii formuláře a vrať POUZE validní JSON (bez markdown) podle schématu:
{
  "lines": [
    {
      "form_date": "YYYY-MM-DD",
      "line_role": "attendance_primary",
      "work_start": "HH:MM",
      "work_end": "HH:MM",
      "order_code": "BRN-024",
      "performance_hours": 0,
      "manual_dig_bm": 0,
      "penetration_ks": 0,
      "daily_advance": 0,
      "ai_confidence": 0.0,
      "attendance_status": "pritomen"
    }
  ],
  "summary": {
    "total_hours": 0,
    "total_bm": 0,
    "total_penetrations": 0,
    "total_advance": 0
  },
  "overall_confidence": 0.0
}

Pravidla:
- Formulář má jednu stránku A4 s 31 řádky.
- Sloupce tabulky: Den, Datum, Zakázka, Od, Do, Celkem hodin, Ruční výkop hloubka 50–70 cm (bm), Průraz do objektu (ks), Záloha (Kč), Podpis.
- Osobní údaje v hlavičce IGNORUJ — jsou již v ERP.
- attendance_primary = jeden řádek za den s vyplněnými daty.
- performance_hours = sloupec Celkem hodin.
- manual_dig_bm = metry výkopu (bm).
- penetration_ks = počet průrazů (ks).
- daily_advance = záloha v Kč.
- order_code ve formátu XXX-NNN (např. BRN-024).
- Každý den může mít jinou zakázku — nikdy nepředpokládej jednu zakázku pro celý měsíc.
- Prázdné dny neuváděj.
- Souhrn na konci: total_hours, total_bm, total_penetrations, total_advance.`

function setCors(res) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value)
  }
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

async function extractWithGemini(imageBase64, mimeType, orderLegend, month, year) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING')

  const legendText = Array.isArray(orderLegend)
    ? orderLegend.map((o) => `${o.short_code}: ${o.name} (${o.location})`).join('\n')
    : ''

  const userPrompt = `Měsíc/rok formuláře: ${month}/${year}
Legenda zakázek:
${legendText || '(bez legendy)'}

Extrahuj pouze ručně vyplněná pole z tabulky a souhrnu.`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: userPrompt },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
      signal: controller.signal,
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error?.message ?? `Gemini HTTP ${res.status}`)
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!raw) throw new Error('Gemini nevrátil data')

    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    return JSON.parse(cleaned)
  } finally {
    clearTimeout(timeout)
  }
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
      return res.status(401).json({ error: 'Pro import se musíte přihlásit jako administrátor.' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const imageBase64 = String(body?.image_base64 ?? '').replace(/^data:[^;]+;base64,/, '')
    const mimeType = String(body?.mime_type ?? 'image/jpeg')
    const orderLegend = body?.order_legend ?? []
    const month = Number(body?.month ?? 0)
    const year = Number(body?.year ?? 0)

    if (!imageBase64 || imageBase64.length < 100) {
      return res.status(400).json({ error: 'Chybí soubor formuláře (foto nebo PDF).' })
    }

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedMime.includes(mimeType)) {
      return res.status(400).json({ error: 'Nepodporovaný formát. Použijte JPG, PNG, WEBP nebo PDF.' })
    }

    const result = await extractWithGemini(imageBase64, mimeType, orderLegend, month, year)

    return res.status(200).json({
      ...result,
      ai_model: GEMINI_MODEL,
      ai_assisted: true,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'

    if (message === 'GEMINI_API_KEY_MISSING') {
      return res.status(503).json({ error: 'AI import není dostupný. Chybí GEMINI_API_KEY.' })
    }

    if (message.includes('abort') || message.includes('AbortError')) {
      return res.status(504).json({ error: 'AI zpracování trvalo příliš dlouho. Zkuste menší foto nebo lepší osvětlení.' })
    }

    return res.status(500).json({ error: 'AI import se nezdařil. Zkuste ruční zadání nebo lepší fotografii.' })
  }
}

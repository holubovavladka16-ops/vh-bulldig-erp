/**
 * Proxy pro OpenStreetMap Nominatim – geokódování adres bez CORS blokace v prohlížeči.
 */
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'VH-Bulldig-ERP/2.0 (https://vh-bulldig-erp.vercel.app; geocode-proxy)'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!query) return res.status(400).json({ error: 'Chybí parametr q' })

  try {
    const url = new URL(NOMINATIM_SEARCH)
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'cz')
    url.searchParams.set('accept-language', 'cs')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'cs',
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return res.status(502).json({ error: `Nominatim HTTP ${response.status}` })
    }

    const data = (await response.json()) ?? []
    const hit = data[0]
    if (!hit?.lat || !hit?.lon) {
      return res.status(404).json({ error: 'Adresa nenalezena' })
    }

    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(502).json({ error: 'Neplatná odpověď geokódování' })
    }

    return res.status(200).json({
      lat,
      lng,
      display_name: hit.display_name?.trim() || query,
    })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Geokódování selhalo',
    })
  }
}

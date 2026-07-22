import type { AresCompanyData } from '@/types/invoices'

interface AresSidlo {
  textovaAdresa?: string
  nazevObce?: string
  psc?: number | string
}

interface AresResponse {
  ico?: string
  obchodniJmeno?: string
  dic?: string
  sidlo?: AresSidlo
}

function normalizeIco(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 8)
}

function parseCityFromAddress(textovaAdresa: string, nazevObce?: string): string {
  if (nazevObce?.trim()) return nazevObce.trim()
  const parts = textovaAdresa.split(',').map((p) => p.trim())
  return parts[parts.length - 1] ?? ''
}

function parsePostalCode(textovaAdresa: string, psc?: number | string): string {
  if (psc != null) return String(psc).replace(/\s/g, '')
  const match = textovaAdresa.match(/\b(\d{3}\s?\d{2})\b/)
  return match ? match[1].replace(/\s/g, '') : ''
}

export async function lookupAresByIco(rawIco: string): Promise<AresCompanyData> {
  const ico = normalizeIco(rawIco)
  if (ico.length !== 8) {
    throw new Error('IČO musí mít 8 číslic')
  }

  const response = await fetch(
    `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`,
    { headers: { Accept: 'application/json' } }
  )

  if (response.status === 404) {
    throw new Error('Subjekt s tímto IČO nebyl v ARES nalezen')
  }

  if (!response.ok) {
    throw new Error('ARES není momentálně dostupný')
  }

  const data = (await response.json()) as AresResponse
  const sidlo = data.sidlo ?? {}
  const textovaAdresa = sidlo.textovaAdresa?.trim() ?? ''

  return {
    ico,
    name: data.obchodniJmeno?.trim() ?? '',
    dic: data.dic?.trim() ?? '',
    address: textovaAdresa,
    city: parseCityFromAddress(textovaAdresa, sidlo.nazevObce),
    postal_code: parsePostalCode(textovaAdresa, sidlo.psc),
  }
}

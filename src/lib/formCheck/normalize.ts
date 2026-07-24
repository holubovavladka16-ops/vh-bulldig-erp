/** Limit spolehlivosti OCR – pod ním se neshoda neoznačuje jako definitivní. */
export const OCR_LOW_CONFIDENCE_THRESHOLD = 0.8

export function normalizeDate(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return trimmed.toLowerCase()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function normalizeText(value: string | null | undefined): string {
  if (value == null) return ''
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function normalizeOrderCode(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s+/g, '')
}

/**
 * Převod hodnoty na číslo – podporuje čárku, tečku, formát času 8:00.
 */
export function normalizeNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const trimmed = String(value).trim().toLowerCase()
  if (!trimmed) return null

  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const hours = Number(timeMatch[1])
    const minutes = Number(timeMatch[2])
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
    return hours + minutes / 60
  }

  const normalized = trimmed.replace(/\s+/g, '').replace(',', '.')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

export function numbersEqual(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  tolerance = 0.01
): boolean {
  const na = normalizeNumber(a)
  const nb = normalizeNumber(b)
  if (na == null && nb == null) return true
  if (na == null || nb == null) return false
  return Math.abs(na - nb) <= tolerance
}

export function isEmptyValue(value: string | number | null | undefined): boolean {
  if (value == null) return true
  if (typeof value === 'string') return normalizeText(value) === ''
  return false
}

export function isZeroOrEmpty(value: string | number | null | undefined): boolean {
  if (isEmptyValue(value)) return true
  const num = normalizeNumber(value)
  return num === 0
}

export function textsEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return normalizeText(a) === normalizeText(b)
}

export function orderCodesEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeOrderCode(a)
  const nb = normalizeOrderCode(b)
  if (!na && !nb) return true
  if (!na || !nb) return false
  return na === nb
}

export function formatNumberForDisplay(value: number | null, suffix = ''): string {
  if (value == null) return '—'
  const rounded = Math.round(value * 100) / 100
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '')
  return `${display}${suffix}`
}

export function formatDateCs(isoDate: string): string {
  const normalized = normalizeDate(isoDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return isoDate
  const [y, m, d] = normalized.split('-')
  return `${d}.${m}.${y}`
}

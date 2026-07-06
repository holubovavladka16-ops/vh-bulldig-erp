export interface DateParts {
  year: number
  month: number
  day: number
}

const ISO_DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})/
const CZ_DATE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/

/** Rozparsuje ISO (YYYY-MM-DD) nebo české (DD.MM.RRRR) datum bez timezone posunu. */
export function parseDateParts(value: string | null | undefined): DateParts | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()

  const iso = trimmed.match(ISO_DATE_PREFIX_RE)
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
  }

  const cz = trimmed.match(CZ_DATE_RE)
  if (cz) {
    return { year: Number(cz[3]), month: Number(cz[2]), day: Number(cz[1]) }
  }

  return null
}

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const probe = new Date(year, month - 1, day)
  return probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day
}

export function toIsoDateFromParts(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

/** Normalizuje datum z API/DB na YYYY-MM-DD pro ukládání a `<input type="date">`. */
export function toDateInputValue(value: string | null | undefined): string {
  const parts = parseDateParts(value)
  if (!parts || !isValidCalendarDate(parts.year, parts.month, parts.day)) return ''
  return toIsoDateFromParts(parts)
}

/** Formát DD.MM.RRRR – vždy bez posunu kvůli timezone. */
export function formatDateCz(value: string | null | undefined): string {
  const parts = parseDateParts(value)
  if (!parts) return ''
  return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${parts.year}`
}

/** Přijme ISO nebo české datum a vrátí YYYY-MM-DD pro databázi. */
export function normalizeDateForDb(value: string | null | undefined): string {
  return toDateInputValue(value)
}

/** Parsuje uživatelský vstup (DD.MM.RRRR nebo YYYY-MM-DD). Prázdný řetězec → ''. Neplatné → null. */
export function parseFlexibleDateInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const iso = toDateInputValue(trimmed)
  return iso || null
}

/** Dnešní datum jako YYYY-MM-DD v lokálním čase. */
export function todayIsoDate(): string {
  const now = new Date()
  return toIsoDateFromParts({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  })
}

/** Maskuje průběžný vstup na DD.MM.RRRR (volitelně zkrácený během psaní). */
export function maskCzechDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

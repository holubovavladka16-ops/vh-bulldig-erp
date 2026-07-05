/** Normalizuje datum z API/DB na formát YYYY-MM-DD pro `<input type="date">`. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const isoPrefix = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoPrefix) return isoPrefix[1]

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

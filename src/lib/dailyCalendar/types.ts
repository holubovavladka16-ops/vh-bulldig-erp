/**
 * Denní provozní kalendář – automatický manažerský přehled.
 *
 * Žádná hodnota zde se nezadává ručně. Vše se počítá na Supabase straně
 * (funkce `compute_daily_calendar_summary`, migrace 088) ze zdrojových
 * modulů: Stavební deník, Fotodokumentace GPS, Náklady a Výkazy zaměstnanců.
 */
export interface OrderDaySummary {
  /** Datum ve formátu YYYY-MM-DD. */
  date: string
  orderId: string
  orderName: string
  diaryFilled: boolean
  photosCount: number
  costsTotal: number
  wagesTotal: number
  dailyTotal: number
  missingDiary: boolean
  missingPhotos: boolean
  missingCosts: boolean
  missingAttendance: boolean
  /** Kdy byl souhrn naposledy automaticky přepočítán (informativní). */
  computedAt: string | null
}

export function hasAnyMissingData(summary: OrderDaySummary): boolean {
  return summary.missingDiary || summary.missingPhotos || summary.missingCosts || summary.missingAttendance
}

export function listMissingDataMessages(summary: OrderDaySummary): string[] {
  const messages: string[] = []
  if (summary.missingDiary) messages.push('Chybí stavební deník.')
  if (summary.missingPhotos) messages.push('Chybí fotografie.')
  if (summary.missingCosts) messages.push('Chybí náklady.')
  if (summary.missingAttendance) messages.push('Chybí docházka pro výpočet výplat.')
  return messages
}

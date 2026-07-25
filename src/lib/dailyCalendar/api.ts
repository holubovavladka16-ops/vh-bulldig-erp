import { supabase } from '@/lib/supabase'
import type { OrderDaySummary } from '@/lib/dailyCalendar/types'

interface SummaryRow {
  entry_date: string
  order_id: string
  diary_filled: boolean
  photos_count: number
  costs_total: number
  wages_total: number
  daily_total: number
  missing_diary: boolean
  missing_photos: boolean
  missing_costs: boolean
  missing_attendance: boolean
  computed_at: string | null
  job_orders?: { name: string } | null
}

function mapRow(row: SummaryRow): OrderDaySummary {
  return {
    date: row.entry_date,
    orderId: row.order_id,
    orderName: row.job_orders?.name ?? 'Neznámá zakázka',
    diaryFilled: row.diary_filled,
    photosCount: row.photos_count,
    costsTotal: Number(row.costs_total),
    wagesTotal: Number(row.wages_total),
    dailyTotal: Number(row.daily_total),
    missingDiary: row.missing_diary,
    missingPhotos: row.missing_photos,
    missingCosts: row.missing_costs,
    missingAttendance: row.missing_attendance,
    computedAt: row.computed_at,
  }
}

/**
 * Načte automatické souhrny všech zakázek pro konkrétní den.
 * Řádek existuje jen pro zakázky, které mají za daný den alespoň nějaká
 * data – to zajišťuje databázová strana (viz migrace 088).
 */
export async function fetchDaySummaries(date: string): Promise<OrderDaySummary[]> {
  const { data, error } = await supabase
    .from('daily_calendar_entries')
    .select('*, job_orders:order_id ( name )')
    .eq('entry_date', date)
    .order('order_id', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as SummaryRow[])
    .map(mapRow)
    .sort((a, b) => a.orderName.localeCompare(b.orderName, 'cs'))
}

/**
 * Načte jen data pro tečkové indikátory v měsíční mřížce – které dny mají
 * alespoň jednu zakázku s automatickým souhrnem.
 */
export async function fetchMonthSummaryDates(year: number, month: number): Promise<Set<string>> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('daily_calendar_entries')
    .select('entry_date')
    .gte('entry_date', from)
    .lte('entry_date', to)

  if (error) throw new Error(error.message)

  return new Set((data ?? []).map((row) => (row as { entry_date: string }).entry_date))
}

import { supabase } from '@/lib/supabase'
import { adminGetFormTaskItems } from '@/lib/workers/api'
import { fetchAllAttendance } from '@/lib/workers/module5'
import type { ErpAttendanceDay } from '@/types/formCheck'

function monthDateRange(month: number, year: number): { dateFrom: string; dateTo: string } {
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return {
    dateFrom: `${year}-${mm}-01`,
    dateTo: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

function sumTaskItemsByPrefix(
  items: Array<{ item_name?: string; quantity: number }>,
  prefix: string
): number {
  return items
    .filter((item) => item.item_name?.toLowerCase().startsWith(prefix.toLowerCase()))
    .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
}

/**
 * Načte docházku zaměstnance za daný měsíc z tabulky worker_attendance_records.
 * Doplňuje kódy zakázek z job_orders a výkony z worker_form_task_items.
 */
export async function fetchWorkerMonthlyAttendanceForCompare(
  workerId: string,
  month: number,
  year: number
): Promise<ErpAttendanceDay[]> {
  const { dateFrom, dateTo } = monthDateRange(month, year)

  const rows = await fetchAllAttendance({
    workerId,
    dateFrom,
    dateTo,
    sortBy: 'date',
    sortDir: 'asc',
  })

  const orderIds = [...new Set(rows.map((r) => r.order_id).filter(Boolean))] as string[]
  const orderCodeById = new Map<string, string>()

  if (orderIds.length > 0) {
    const { data: orders, error } = await supabase
      .from('job_orders')
      .select('id, short_code, name')
      .in('id', orderIds)

    if (error) throw new Error(error.message)

    for (const order of orders ?? []) {
      orderCodeById.set(order.id as string, (order.short_code as string | null) ?? '')
    }
  }

  return Promise.all(
    rows.map(async (row) => {
      let manualDigBm: number | null = row.meters ?? null
      let penetrationKs: number | null = row.pieces ?? null

      if (row.form_id) {
        try {
          const taskItems = await adminGetFormTaskItems(row.form_id)
          const dig = sumTaskItemsByPrefix(taskItems, 'Ruční výkop hloubka 50')
          const penetration = sumTaskItemsByPrefix(taskItems, 'Průraz do objektu')
          if (dig > 0) manualDigBm = dig
          if (penetration > 0) penetrationKs = penetration
        } catch {
          // Zachovat agregované hodnoty z formuláře
        }
      }

      const orderCode = row.order_id ? orderCodeById.get(row.order_id) ?? null : null

      return {
        date: row.attendance_date,
        hours: row.hours ?? null,
        orderCode: orderCode || null,
        orderName: row.order_name || null,
        manualDigBm,
        penetrationKs,
        advance: row.daily_advance ?? null,
        note: row.note || null,
      }
    })
  )
}

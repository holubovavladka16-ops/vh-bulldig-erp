import { supabase } from '@/lib/supabase'
import { fetchJobOrder } from '@/lib/orders/api'
import { PRICE_UNIT_LABELS } from '@/constants/workers'
import type { PriceUnitType } from '@/types/workers'
import type { DiaryPrefillData, DiaryPrefillWorker } from '@/types/diary'

type AttendancePrefillRow = {
  hours: number
  workers: { id: string; first_name: string; last_name: string } | null
  worker_daily_forms: {
    hours: number
    activity: string
    material: string
    worker_form_task_items: Array<{
      quantity: number
      worker_price_items: { name: string; unit_type: PriceUnitType } | null
    }> | null
  } | null
}

function formatWorkerPerformance(row: AttendancePrefillRow): string {
  const worker = row.workers
  if (!worker) return ''

  const name = `${worker.last_name} ${worker.first_name}`
  const parts: string[] = []
  const form = row.worker_daily_forms

  const hours = Number(form?.hours ?? row.hours ?? 0)
  if (hours > 0) parts.push(`${hours} h`)

  for (const item of form?.worker_form_task_items ?? []) {
    const qty = Number(item.quantity)
    if (qty <= 0) continue
    const priceItem = item.worker_price_items
    if (!priceItem) continue
    const unit = PRICE_UNIT_LABELS[priceItem.unit_type]?.replace('Kč/', '') ?? ''
    parts.push(`${priceItem.name} ${qty} ${unit}`.trim())
  }

  if (parts.length === 0 && form?.activity) parts.push(form.activity)
  if (parts.length === 0) return name

  return `${name}: ${parts.join(', ')}`
}

export async function fetchDiaryPrefill(orderId: string, entryDate: string): Promise<DiaryPrefillData> {
  const [order, attendanceResult] = await Promise.all([
    fetchJobOrder(orderId),
    supabase
      .from('worker_attendance_records')
      .select(`
        hours,
        workers:worker_id ( id, first_name, last_name ),
        worker_daily_forms:form_id (
          hours, activity, material,
          worker_form_task_items (
            quantity,
            worker_price_items:price_item_id ( name, unit_type )
          )
        )
      `)
      .eq('order_id', orderId)
      .eq('attendance_date', entryDate)
      .eq('attendance_status', 'pritomen'),
  ])

  if (attendanceResult.error) throw new Error(attendanceResult.error.message)

  const rows = (attendanceResult.data ?? []) as AttendancePrefillRow[]
  const workers: DiaryPrefillWorker[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const w = row.workers
    if (!w || seen.has(w.id)) continue
    seen.add(w.id)
    workers.push({
      id: w.id,
      first_name: w.first_name,
      last_name: w.last_name,
      full_name: `${w.last_name} ${w.first_name}`,
    })
  }

  workers.sort((a, b) => a.full_name.localeCompare(b.full_name, 'cs'))

  const performanceLines = rows.map(formatWorkerPerformance).filter(Boolean)
  const materialHints = [
    ...new Set(
      rows
        .map((r) => r.worker_daily_forms?.material?.trim())
        .filter((m): m is string => Boolean(m))
    ),
  ]

  return {
    order_name: order?.name ?? '',
    site_location: order?.location ?? '',
    workers,
    worker_count: workers.length,
    worker_names: workers.map((w) => w.full_name).join(', '),
    performances_summary: performanceLines.join('\n'),
    material_hints: materialHints,
    photos: [],
  }
}

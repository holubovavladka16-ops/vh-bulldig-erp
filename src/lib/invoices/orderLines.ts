import { supabase } from '@/lib/supabase'
import type { InvoiceLineInput } from '@/types/invoices'

interface AggregatedLine {
  name: string
  quantity: number
  unit: string
  unit_price: number
  source_type: 'worker_report' | 'job_cost'
  source_id: string | null
}

function aggregateKey(name: string, unit: string, unitPrice: number): string {
  return `${name.trim().toLowerCase()}|${unit}|${unitPrice}`
}

export async function loadInvoiceLinesFromOrder(orderId: string): Promise<InvoiceLineInput[]> {
  const [reportsResult, costsResult] = await Promise.all([
    supabase
      .from('worker_reports')
      .select('id, activity, hours, meters, pieces, earnings, status')
      .eq('order_id', orderId)
      .in('status', ['schvaleny', 'cekajici']),
    supabase
      .from('job_costs')
      .select('id, name, price, note')
      .eq('order_id', orderId),
  ])

  if (reportsResult.error) throw new Error(reportsResult.error.message)
  if (costsResult.error) throw new Error(costsResult.error.message)

  const aggregated = new Map<string, AggregatedLine>()

  for (const report of reportsResult.data ?? []) {
    const activity = String(report.activity ?? '').trim()
    if (!activity) continue

    let quantity = 0
    let unit = 'ks'
    if (Number(report.hours) > 0) {
      quantity = Number(report.hours)
      unit = 'hod'
    } else if (Number(report.meters) > 0) {
      quantity = Number(report.meters)
      unit = 'm'
    } else if (Number(report.pieces) > 0) {
      quantity = Number(report.pieces)
      unit = 'ks'
    } else {
      quantity = 1
    }

    const earnings = Number(report.earnings) || 0
    const unitPrice = quantity > 0 ? Math.round((earnings / quantity) * 100) / 100 : earnings
    const key = aggregateKey(activity, unit, unitPrice)

    const existing = aggregated.get(key)
    if (existing) {
      existing.quantity += quantity
      existing.source_id = null
    } else {
      aggregated.set(key, {
        name: activity,
        quantity,
        unit,
        unit_price: unitPrice,
        source_type: 'worker_report',
        source_id: String(report.id),
      })
    }
  }

  for (const cost of costsResult.data ?? []) {
    const row = cost as Record<string, unknown>
    const name = String(row.name ?? '').trim()
    if (!name) continue
    const unitPrice = Number(row.price) || 0
    const note = row.note != null ? String(row.note).trim() : ''
    const key = aggregateKey(name, 'ks', unitPrice)

    const existing = aggregated.get(key)
    if (existing) {
      existing.quantity += 1
      existing.source_id = null
    } else {
      aggregated.set(key, {
        name: note ? `${name} (${note})` : name,
        quantity: 1,
        unit: 'ks',
        unit_price: unitPrice,
        source_type: 'job_cost',
        source_id: String(row.id),
      })
    }
  }

  return Array.from(aggregated.values()).map((line) => ({
    name: line.name,
    quantity: Math.round(line.quantity * 1000) / 1000,
    unit: line.unit,
    unit_price: line.unit_price,
    source_type: line.source_type,
    source_id: line.source_id,
  }))
}

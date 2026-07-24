import { supabase } from '@/lib/supabase'
import type {
  CreateInvoiceableItemInput,
  CreateInvoiceableLineInput,
  CreateInvoiceableReportInput,
  InvoiceableHistoryEntry,
  InvoiceableItem,
  InvoiceableOrderItemPrice,
  InvoiceableReportStatus,
  InvoiceableWorkReport,
  InvoiceableWorkReportDetail,
  InvoiceableWorkReportLine,
  InvoiceableWorkReportListItem,
  OrderOption,
  UpdateInvoiceableLineInput,
  UpdateInvoiceableReportInput,
} from '@/types/invoiceableWorkReports'

interface LineRow {
  id: string
  report_id: string
  order_id: string
  work_date: string
  item_id: string | null
  item_name: string
  item_category: string | null
  unit: string
  quantity: number
  unit_price: number
  line_total: number
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  job_orders?: { name: string } | null
}

function mapLineRow(row: LineRow): InvoiceableWorkReportLine {
  return {
    id: row.id,
    report_id: row.report_id,
    order_id: row.order_id,
    order_name: row.job_orders?.name ?? null,
    work_date: row.work_date,
    item_id: row.item_id,
    item_name: row.item_name,
    item_category: row.item_category,
    unit: row.unit,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    line_total: Number(row.line_total),
    note: row.note,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function logHistory(
  reportId: string,
  action: 'created' | 'line_added' | 'line_updated' | 'line_removed',
  changedBy: string,
  lineId: string | null = null,
  details: Record<string, unknown> | null = null
): Promise<void> {
  const { error } = await supabase.from('invoiceable_work_report_history').insert({
    report_id: reportId,
    line_id: lineId,
    action,
    changed_by: changedBy,
    details,
  })
  // Historie je pomocná evidence – chyba při jejím zápisu nesmí zablokovat hlavní akci.
  if (error) console.error('Zápis historie selhal:', error.message)
}

/** Seznam výkazů se spočítaným součtem a počtem položek (počítáno na klientovi, nic se neukládá navíc). */
export async function fetchReports(filters: {
  status?: InvoiceableReportStatus
  orderId?: string
  dateFrom?: string
  dateTo?: string
} = {}): Promise<InvoiceableWorkReportListItem[]> {
  let query = supabase
    .from('invoiceable_work_reports')
    .select('*, profiles:created_by ( full_name )')
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.dateFrom) query = query.gte('period_to', filters.dateFrom)
  if (filters.dateTo) query = query.lte('period_from', filters.dateTo)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const reports = (data ?? []) as (InvoiceableWorkReport & { profiles?: { full_name: string } | null })[]
  if (reports.length === 0) return []

  const reportIds = reports.map((r) => r.id)
  const { data: lineRows, error: lineError } = await supabase
    .from('invoiceable_work_report_lines')
    .select('report_id, order_id, line_total')
    .in('report_id', reportIds)

  if (lineError) throw new Error(lineError.message)

  const byReport = new Map<string, { total: number; count: number; orderIds: Set<string> }>()
  for (const row of (lineRows ?? []) as { report_id: string; order_id: string; line_total: number }[]) {
    const current = byReport.get(row.report_id) ?? { total: 0, count: 0, orderIds: new Set<string>() }
    current.total += Number(row.line_total)
    current.count += 1
    current.orderIds.add(row.order_id)
    byReport.set(row.report_id, current)
  }

  return reports
    .filter((r) => !filters.orderId || byReport.get(r.id)?.orderIds.has(filters.orderId as string))
    .map((r) => {
      const { profiles, ...rest } = r
      return {
        ...rest,
        total_amount: byReport.get(r.id)?.total ?? 0,
        line_count: byReport.get(r.id)?.count ?? 0,
        order_count: byReport.get(r.id)?.orderIds.size ?? 0,
        creator_name: profiles?.full_name ?? null,
      }
    })
}

export async function fetchReportDetail(id: string): Promise<InvoiceableWorkReportDetail | null> {
  const { data: report, error } = await supabase
    .from('invoiceable_work_reports')
    .select('*, creator:created_by ( full_name ), closer:closed_by ( full_name )')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!report) return null

  const { data: lineRows, error: lineError } = await supabase
    .from('invoiceable_work_report_lines')
    .select('*, job_orders:order_id ( name )')
    .eq('report_id', id)
    .order('work_date', { ascending: true })

  if (lineError) throw new Error(lineError.message)

  const row = report as InvoiceableWorkReport & {
    creator?: { full_name: string } | null
    closer?: { full_name: string } | null
  }
  const { creator, closer, ...reportFields } = row

  return {
    ...reportFields,
    creator_name: creator?.full_name ?? null,
    closed_by_name: closer?.full_name ?? null,
    lines: ((lineRows ?? []) as LineRow[]).map(mapLineRow),
  }
}

export async function createReport(
  input: CreateInvoiceableReportInput,
  createdBy: string
): Promise<InvoiceableWorkReport> {
  const { data, error } = await supabase
    .from('invoiceable_work_reports')
    .insert({
      name: input.name.trim(),
      period_from: input.period_from,
      period_to: input.period_to,
      note: input.note?.trim() || null,
      customer_name: input.customer_name?.trim() || null,
      contract_number: input.contract_number?.trim() || null,
      purchase_order_number: input.purchase_order_number?.trim() || null,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  const report = data as InvoiceableWorkReport
  await logHistory(report.id, 'created', createdBy)
  return report
}

export async function updateReportHeader(
  id: string,
  input: UpdateInvoiceableReportInput
): Promise<InvoiceableWorkReport> {
  const { data, error } = await supabase
    .from('invoiceable_work_reports')
    .update({
      name: input.name.trim(),
      period_from: input.period_from,
      period_to: input.period_to,
      note: input.note.trim() || null,
      customer_name: input.customer_name.trim() || null,
      contract_number: input.contract_number.trim() || null,
      purchase_order_number: input.purchase_order_number.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as InvoiceableWorkReport
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from('invoiceable_work_reports').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function closeReport(id: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('close_invoiceable_work_report', {
    p_report_id: id,
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
}

export async function reopenReport(id: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_invoiceable_work_report', {
    p_report_id: id,
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
}

export async function addLine(
  reportId: string,
  input: CreateInvoiceableLineInput,
  createdBy: string
): Promise<InvoiceableWorkReportLine> {
  const { data, error } = await supabase
    .from('invoiceable_work_report_lines')
    .insert({
      report_id: reportId,
      order_id: input.order_id,
      work_date: input.work_date,
      item_id: input.item_id,
      item_name: input.item_name,
      item_category: input.item_category,
      unit: input.unit,
      quantity: input.quantity,
      unit_price: input.unit_price,
      note: input.note?.trim() || null,
      created_by: createdBy,
    })
    .select('*, job_orders:order_id ( name )')
    .single()

  if (error) throw new Error(error.message)
  const line = mapLineRow(data as LineRow)
  await logHistory(reportId, 'line_added', createdBy, line.id, {
    new: { item_name: line.item_name, quantity: line.quantity, unit_price: line.unit_price },
  })
  return line
}

export async function updateLine(
  lineId: string,
  input: UpdateInvoiceableLineInput,
  changedBy: string,
  previous: InvoiceableWorkReportLine
): Promise<InvoiceableWorkReportLine> {
  const { data, error } = await supabase
    .from('invoiceable_work_report_lines')
    .update({
      order_id: input.order_id,
      work_date: input.work_date,
      item_id: input.item_id,
      item_name: input.item_name,
      item_category: input.item_category,
      unit: input.unit,
      quantity: input.quantity,
      unit_price: input.unit_price,
      note: input.note?.trim() || null,
    })
    .eq('id', lineId)
    .select('*, job_orders:order_id ( name )')
    .single()

  if (error) throw new Error(error.message)
  const updated = mapLineRow(data as LineRow)
  await logHistory(updated.report_id, 'line_updated', changedBy, lineId, {
    old: { item_name: previous.item_name, quantity: previous.quantity, unit_price: previous.unit_price },
    new: { item_name: updated.item_name, quantity: updated.quantity, unit_price: updated.unit_price },
  })
  return updated
}

export async function deleteLine(
  line: InvoiceableWorkReportLine,
  changedBy: string
): Promise<void> {
  const { error } = await supabase.from('invoiceable_work_report_lines').delete().eq('id', line.id)
  if (error) throw new Error(error.message)
  await logHistory(line.report_id, 'line_removed', changedBy, null, {
    old: { item_name: line.item_name, quantity: line.quantity, unit_price: line.unit_price, order_name: line.order_name },
  })
}

export async function fetchActiveItems(): Promise<InvoiceableItem[]> {
  const { data, error } = await supabase
    .from('invoiceable_items')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as InvoiceableItem[]
}

export async function createItem(input: CreateInvoiceableItemInput, createdBy: string): Promise<InvoiceableItem> {
  const { data, error } = await supabase
    .from('invoiceable_items')
    .insert({
      name: input.name.trim(),
      category: input.category.trim() || null,
      unit: input.unit.trim(),
      price_from: input.price_from,
      price_to: input.price_to,
      price_step: input.price_step,
      default_price: input.default_price,
      allow_custom_price: input.allow_custom_price,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as InvoiceableItem
}

export async function fetchRememberedPrice(
  orderId: string,
  itemId: string
): Promise<InvoiceableOrderItemPrice | null> {
  const { data, error } = await supabase
    .from('invoiceable_order_item_prices')
    .select('*')
    .eq('order_id', orderId)
    .eq('item_id', itemId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as InvoiceableOrderItemPrice | null
}

export async function fetchOrderOptions(): Promise<OrderOption[]> {
  const { data, error } = await supabase
    .from('job_orders')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as OrderOption[]
}

export async function fetchHistory(reportId: string): Promise<InvoiceableHistoryEntry[]> {
  const { data, error } = await supabase
    .from('invoiceable_work_report_history')
    .select('*, profiles:changed_by ( full_name )')
    .eq('report_id', reportId)
    .order('changed_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<Record<string, unknown> & { profiles?: { full_name: string } | null }>).map(
    (row) => ({
      id: row.id as string,
      report_id: row.report_id as string,
      line_id: (row.line_id as string) ?? null,
      action: row.action as InvoiceableHistoryEntry['action'],
      changed_by: (row.changed_by as string) ?? null,
      changed_by_name: row.profiles?.full_name ?? null,
      changed_at: row.changed_at as string,
      details: (row.details as Record<string, unknown>) ?? null,
    })
  )
}

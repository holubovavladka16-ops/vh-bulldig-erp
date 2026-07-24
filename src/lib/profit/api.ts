import { supabase } from '@/lib/supabase'
import type {
  OrderInvoice,
  OrderInvoiceCreateInput,
  OrderProfitRow,
  ProfitOverviewFilters,
} from '@/types/profit'

function mapProfitRow(row: Record<string, unknown>): OrderProfitRow {
  return {
    order_id: String(row.order_id),
    order_name: String(row.order_name),
    period_from: String(row.period_from),
    period_to: String(row.period_to),
    invoiced_amount: Number(row.invoiced_amount),
    labor_costs: Number(row.labor_costs),
    employee_advances: Number(row.employee_advances),
    material_costs: Number(row.material_costs),
    tools_costs: Number(row.tools_costs),
    rental_costs: Number(row.rental_costs),
    accommodation_costs: Number(row.accommodation_costs),
    fuel_costs: Number(row.fuel_costs),
    tickets_costs: Number(row.tickets_costs),
    other_costs: Number(row.other_costs),
    total_costs: Number(row.total_costs),
    net_profit: Number(row.net_profit),
    profit_margin: row.profit_margin == null ? null : Number(row.profit_margin),
  }
}

export async function fetchProfitOverview(filters: ProfitOverviewFilters = {}): Promise<OrderProfitRow[]> {
  const { data, error } = await supabase.rpc('get_profit_overview', {
    p_order_id: filters.orderId ?? null,
    p_date_from: filters.dateFrom ?? null,
    p_date_to: filters.dateTo ?? null,
  })

  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapProfitRow)
}

type InvoiceRow = OrderInvoice & { job_orders: { name: string } | null }

export async function fetchOrderInvoices(orderId?: string): Promise<OrderInvoice[]> {
  let query = supabase
    .from('job_order_invoices')
    .select('*, job_orders(name)')
    .order('invoice_date', { ascending: false })

  if (orderId) query = query.eq('order_id', orderId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return ((data ?? []) as InvoiceRow[]).map((row) => ({
    id: row.id,
    order_id: row.order_id,
    order_name: row.job_orders?.name,
    invoice_date: row.invoice_date,
    invoice_number: row.invoice_number,
    amount: Number(row.amount),
    note: row.note,
    created_by: row.created_by,
    created_at: row.created_at,
  }))
}

export async function createOrderInvoice(
  input: OrderInvoiceCreateInput,
  createdBy: string
): Promise<OrderInvoice> {
  const { data, error } = await supabase
    .from('job_order_invoices')
    .insert({
      order_id: input.order_id,
      invoice_date: input.invoice_date,
      invoice_number: input.invoice_number?.trim() || null,
      amount: input.amount,
      note: input.note?.trim() || null,
      created_by: createdBy,
    })
    .select('*, job_orders(name)')
    .single()

  if (error) throw new Error(error.message)

  const row = data as InvoiceRow
  return {
    id: row.id,
    order_id: row.order_id,
    order_name: row.job_orders?.name,
    invoice_date: row.invoice_date,
    invoice_number: row.invoice_number,
    amount: Number(row.amount),
    note: row.note,
    created_by: row.created_by,
    created_at: row.created_at,
  }
}

export async function deleteOrderInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('job_order_invoices').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

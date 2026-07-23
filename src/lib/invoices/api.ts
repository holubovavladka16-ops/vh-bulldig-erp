import { supabase } from '@/lib/supabase'
import { calculateInvoiceTotals } from '@/lib/invoices/calculations'
import type {
  InvoiceFilters,
  InvoiceLineInput,
  InvoiceSettings,
  IssuedInvoice,
  IssuedInvoiceInput,
  IssuedInvoiceLine,
  IssuedInvoiceStatus,
} from '@/types/invoices'

type InvoiceRow = IssuedInvoice & {
  job_orders: { name: string } | null
}

type InvoiceLineRow = IssuedInvoiceLine

const FAKTUROVAC_MIGRATION_HINT =
  'Modul Fakturovač není inicializovaný v databázi. V Supabase SQL Editoru spusťte soubor supabase/manual/081_082_fakturovac_production.sql.'

function wrapInvoiceDbError(error: { message?: string; code?: string }): Error {
  if (
    error.code === 'PGRST205' ||
    error.message?.includes('schema cache') ||
    error.message?.includes('invoice_settings') ||
    error.message?.includes('issued_invoices') ||
    error.message?.includes('next_invoice_number')
  ) {
    return new Error(FAKTUROVAC_MIGRATION_HINT)
  }
  return new Error(error.message ?? 'Chyba databáze')
}

function mapInvoiceRow(row: InvoiceRow, lines?: IssuedInvoiceLine[]): IssuedInvoice {
  return {
    id: row.id,
    invoice_number: row.invoice_number,
    variable_symbol: row.variable_symbol,
    order_id: row.order_id,
    order_name: row.job_orders?.name ?? row.order_name,
    status: row.status,
    issue_date: row.issue_date,
    taxable_date: row.taxable_date,
    due_date: row.due_date,
    payment_method: row.payment_method,
    text_variant: row.text_variant,
    custom_text: row.custom_text,
    vat_mode: row.vat_mode,
    customer_name: row.customer_name,
    customer_ico: row.customer_ico,
    customer_dic: row.customer_dic,
    customer_address: row.customer_address,
    customer_city: row.customer_city,
    customer_postal_code: row.customer_postal_code,
    customer_email: row.customer_email,
    subtotal: Number(row.subtotal),
    vat_amount: Number(row.vat_amount),
    total: Number(row.total),
    currency: row.currency,
    note: row.note,
    sent_at: row.sent_at,
    sent_to_email: row.sent_to_email,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    lines,
  }
}

function mapLineRow(row: InvoiceLineRow): IssuedInvoiceLine {
  return {
    id: row.id,
    invoice_id: row.invoice_id,
    sort_order: row.sort_order,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    unit_price: Number(row.unit_price),
    vat_rate: row.vat_rate != null ? Number(row.vat_rate) : null,
    line_total: Number(row.line_total),
    source_type: row.source_type,
    source_id: row.source_id,
    created_at: row.created_at,
  }
}

function assetUrl(path: string | null | undefined): string | null {
  if (!path?.trim()) return null
  const { data } = supabase.storage.from('invoice-assets').getPublicUrl(path)
  return data.publicUrl
}

export function getInvoiceAssetUrl(path: string | null | undefined): string | null {
  return assetUrl(path)
}

export async function fetchInvoiceSettings(): Promise<InvoiceSettings | null> {
  const { data, error } = await supabase.from('invoice_settings').select('*').limit(1).maybeSingle()
  if (error) throw wrapInvoiceDbError(error)
  if (!data) return null

  const row = data as Record<string, unknown>
  return {
    ...(row as unknown as InvoiceSettings),
    default_due_days: Number(row.default_due_days),
    default_vat_rate: Number(row.default_vat_rate),
    is_vat_payer: Boolean(row.is_vat_payer),
  }
}

export async function saveInvoiceSettings(
  settings: Omit<InvoiceSettings, 'created_at' | 'updated_at'>
): Promise<InvoiceSettings> {
  const payload = {
    company_name: settings.company_name.trim(),
    ico: settings.ico.trim(),
    dic: settings.dic.trim(),
    address: settings.address.trim(),
    city: settings.city.trim(),
    postal_code: settings.postal_code.trim(),
    phone: settings.phone.trim(),
    email: settings.email.trim(),
    website: settings.website.trim(),
    bank_account: settings.bank_account.trim(),
    bank_name: settings.bank_name.trim(),
    default_due_days: settings.default_due_days,
    is_vat_payer: settings.is_vat_payer,
    default_vat_rate: settings.default_vat_rate,
    logo_path: settings.logo_path,
    signature_path: settings.signature_path,
    stamp_path: settings.stamp_path,
  }

  const { data, error } = await supabase
    .from('invoice_settings')
    .update(payload)
    .eq('id', settings.id)
    .select('*')
    .single()

  if (error) throw wrapInvoiceDbError(error)
  const row = data as Record<string, unknown>
  return {
    ...(row as unknown as InvoiceSettings),
    default_due_days: Number(row.default_due_days),
    default_vat_rate: Number(row.default_vat_rate),
    is_vat_payer: Boolean(row.is_vat_payer),
  }
}

export async function uploadInvoiceAsset(
  kind: 'logo' | 'signature' | 'stamp',
  file: File
): Promise<string> {
  const path = `${kind}/${Date.now()}_${file.name.replace(/[^\w.-]+/g, '_')}`
  const { error } = await supabase.storage.from('invoice-assets').upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  return path
}

export async function reserveInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('next_invoice_number')
  if (error) throw wrapInvoiceDbError(error)
  return String(data)
}

export async function fetchInvoices(filters: InvoiceFilters = {}): Promise<IssuedInvoice[]> {
  let query = supabase
    .from('issued_invoices')
    .select('*, job_orders(name)')
    .order('issue_date', { ascending: false })
    .order('invoice_number', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.dateFrom) query = query.gte('issue_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('issue_date', filters.dateTo)

  const { data, error } = await query
  if (error) throw wrapInvoiceDbError(error)

  let rows = ((data ?? []) as InvoiceRow[]).map((row) => mapInvoiceRow(row))

  if (filters.search?.trim()) {
    const q = filters.search.toLowerCase().trim()
    rows = rows.filter(
      (inv) =>
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.customer_ico.toLowerCase().includes(q) ||
        inv.customer_name.toLowerCase().includes(q) ||
        String(inv.total).includes(q) ||
        inv.issue_date.includes(q)
    )
  }

  return rows
}

export async function fetchInvoice(id: string): Promise<IssuedInvoice | null> {
  const { data, error } = await supabase
    .from('issued_invoices')
    .select('*, job_orders(name)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw wrapInvoiceDbError(error)
  if (!data) return null

  const { data: lines, error: linesError } = await supabase
    .from('issued_invoice_lines')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order')

  if (linesError) throw wrapInvoiceDbError(linesError)

  return mapInvoiceRow(data as InvoiceRow, ((lines ?? []) as InvoiceLineRow[]).map(mapLineRow))
}

function buildLinePayloads(
  invoiceId: string,
  lines: InvoiceLineInput[],
  vatMode: IssuedInvoiceInput['vat_mode']
) {
  return lines.map((line, index) => {
    const lineTotal = Math.round(line.quantity * line.unit_price * 100) / 100
    return {
      invoice_id: invoiceId,
      sort_order: index,
      name: line.name.trim(),
      quantity: line.quantity,
      unit: line.unit.trim() || 'ks',
      unit_price: line.unit_price,
      vat_rate: line.vat_rate ?? (vatMode === 'none' ? 0 : Number(vatMode)),
      line_total: lineTotal,
      source_type: line.source_type ?? 'manual',
      source_id: line.source_id ?? null,
    }
  })
}

export async function createInvoice(
  input: IssuedInvoiceInput,
  createdBy: string,
  invoiceNumber?: string
): Promise<IssuedInvoice> {
  const number = invoiceNumber ?? (await reserveInvoiceNumber())
  const totals = calculateInvoiceTotals(input.lines, input.vat_mode)

  const { data, error } = await supabase
    .from('issued_invoices')
    .insert({
      invoice_number: number,
      variable_symbol: number,
      order_id: input.order_id ?? null,
      status: input.status ?? 'koncept',
      issue_date: input.issue_date,
      taxable_date: input.taxable_date ?? null,
      due_date: input.due_date ?? null,
      payment_method: input.payment_method,
      text_variant: input.text_variant,
      custom_text: input.custom_text?.trim() ?? '',
      vat_mode: input.vat_mode,
      customer_name: input.customer_name.trim(),
      customer_ico: input.customer_ico.trim(),
      customer_dic: input.customer_dic?.trim() ?? '',
      customer_address: input.customer_address?.trim() ?? '',
      customer_city: input.customer_city?.trim() ?? '',
      customer_postal_code: input.customer_postal_code?.trim() ?? '',
      customer_email: input.customer_email?.trim() ?? '',
      subtotal: totals.subtotal,
      vat_amount: totals.vatAmount,
      total: totals.total,
      note: input.note?.trim() || null,
      created_by: createdBy,
    })
    .select('*, job_orders(name)')
    .single()

  if (error) throw wrapInvoiceDbError(error)

  const created = data as InvoiceRow
  const linePayloads = buildLinePayloads(created.id, input.lines, input.vat_mode)
  if (linePayloads.length > 0) {
    const { error: linesError } = await supabase.from('issued_invoice_lines').insert(linePayloads)
    if (linesError) throw wrapInvoiceDbError(linesError)
  }

  return (await fetchInvoice(created.id))!
}

export async function updateInvoice(id: string, input: IssuedInvoiceInput): Promise<IssuedInvoice> {
  const totals = calculateInvoiceTotals(input.lines, input.vat_mode)

  const { error } = await supabase
    .from('issued_invoices')
    .update({
      order_id: input.order_id ?? null,
      status: input.status ?? 'koncept',
      issue_date: input.issue_date,
      taxable_date: input.taxable_date ?? null,
      due_date: input.due_date ?? null,
      payment_method: input.payment_method,
      text_variant: input.text_variant,
      custom_text: input.custom_text?.trim() ?? '',
      vat_mode: input.vat_mode,
      customer_name: input.customer_name.trim(),
      customer_ico: input.customer_ico.trim(),
      customer_dic: input.customer_dic?.trim() ?? '',
      customer_address: input.customer_address?.trim() ?? '',
      customer_city: input.customer_city?.trim() ?? '',
      customer_postal_code: input.customer_postal_code?.trim() ?? '',
      customer_email: input.customer_email?.trim() ?? '',
      subtotal: totals.subtotal,
      vat_amount: totals.vatAmount,
      total: totals.total,
      note: input.note?.trim() || null,
    })
    .eq('id', id)

  if (error) throw wrapInvoiceDbError(error)

  const { error: deleteError } = await supabase.from('issued_invoice_lines').delete().eq('invoice_id', id)
  if (deleteError) throw wrapInvoiceDbError(deleteError)

  const linePayloads = buildLinePayloads(id, input.lines, input.vat_mode)
  if (linePayloads.length > 0) {
    const { error: linesError } = await supabase.from('issued_invoice_lines').insert(linePayloads)
    if (linesError) throw wrapInvoiceDbError(linesError)
  }

  return (await fetchInvoice(id))!
}

export async function updateInvoiceStatus(
  id: string,
  status: IssuedInvoiceStatus,
  extra?: { sent_at?: string | null; sent_to_email?: string | null }
): Promise<void> {
  const payload: Record<string, unknown> = { status }
  if (extra?.sent_at !== undefined) payload.sent_at = extra.sent_at
  if (extra?.sent_to_email !== undefined) payload.sent_to_email = extra.sent_to_email

  const { error } = await supabase.from('issued_invoices').update(payload).eq('id', id)
  if (error) throw wrapInvoiceDbError(error)
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('issued_invoices').delete().eq('id', id)
  if (error) throw wrapInvoiceDbError(error)
}

export async function createDraftInvoice(createdBy: string): Promise<IssuedInvoice> {
  const settings = await fetchInvoiceSettings()
  const issueDate = new Date().toISOString().slice(0, 10)
  const dueDays = settings?.default_due_days ?? 14
  const dueDate = new Date(`${issueDate}T12:00:00`)
  dueDate.setDate(dueDate.getDate() + dueDays)

  const vatMode = settings?.is_vat_payer ? (String(Math.round(settings.default_vat_rate)) as IssuedInvoiceInput['vat_mode']) : 'none'

  return createInvoice(
    {
      issue_date: issueDate,
      taxable_date: issueDate,
      due_date: dueDate.toISOString().slice(0, 10),
      payment_method: 'bankovni_prevod',
      text_variant: 'prace',
      vat_mode: ['none', '21', '12'].includes(vatMode) ? (vatMode as IssuedInvoiceInput['vat_mode']) : '21',
      customer_name: '',
      customer_ico: '',
      lines: [{ name: '', quantity: 1, unit: 'ks', unit_price: 0 }],
      status: 'koncept',
    },
    createdBy
  )
}

import { supabase } from '@/lib/supabase'
import type {
  Receipt,
  ReceiptCaptureMeta,
  ReceiptCreateInput,
  ReceiptFilters,
} from '@/types/receipts'

type ReceiptRow = Receipt & {
  job_orders: { name: string } | null
}

function mapReceiptRow(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    receipt_date: row.receipt_date,
    order_id: row.order_id,
    order_name: row.job_orders?.name ?? row.order_name,
    expense_name: row.expense_name,
    amount: row.amount != null ? Number(row.amount) : null,
    supplier: row.supplier,
    note: row.note,
    file_path: row.file_path,
    file_name: row.file_name,
    captured_date: row.captured_date,
    captured_time: row.captured_time,
    gps_lat: row.gps_lat != null ? Number(row.gps_lat) : null,
    gps_lng: row.gps_lng != null ? Number(row.gps_lng) : null,
    gps_accuracy: row.gps_accuracy != null ? Number(row.gps_accuracy) : null,
    address_full: row.address_full,
    street: row.street,
    city: row.city,
    postal_code: row.postal_code,
    country: row.country,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function formatTimeValue(date: Date): string {
  return date.toTimeString().slice(0, 8)
}

export function getReceiptPhotoUrl(filePath: string): string {
  const { data } = supabase.storage.from('receipt-photos').getPublicUrl(filePath)
  return data.publicUrl
}

export async function fetchReceipts(filters: ReceiptFilters = {}): Promise<Receipt[]> {
  let query = supabase
    .from('receipts')
    .select('*, job_orders(name)')
    .order('receipt_date', { ascending: false })

  if (filters.orderId) query = query.eq('order_id', filters.orderId)
  if (filters.dateFrom) query = query.gte('receipt_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('receipt_date', filters.dateTo)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as ReceiptRow[]).map(mapReceiptRow)
}

export async function fetchReceipt(id: string): Promise<Receipt | null> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*, job_orders(name)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapReceiptRow(data as ReceiptRow)
}

export async function createReceipt(
  input: ReceiptCreateInput,
  capture: ReceiptCaptureMeta,
  createdBy: string
): Promise<Receipt> {
  const capturedAt = capture.captured_at
  const path = `${capturedAt.getFullYear()}/${Date.now()}_${capture.file.name}`
  const { error: uploadError } = await supabase.storage.from('receipt-photos').upload(path, capture.file)
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await supabase
    .from('receipts')
    .insert({
      receipt_date: input.receipt_date,
      order_id: input.order_id,
      expense_name: input.expense_name.trim(),
      amount: input.amount ?? null,
      supplier: input.supplier?.trim() || null,
      note: input.note?.trim() || null,
      file_path: path,
      file_name: capture.file.name,
      captured_date: capturedAt.toISOString().slice(0, 10),
      captured_time: formatTimeValue(capturedAt),
      gps_lat: capture.gps_lat,
      gps_lng: capture.gps_lng,
      gps_accuracy: capture.gps_accuracy,
      address_full: capture.address_full,
      street: capture.street,
      city: capture.city,
      postal_code: capture.postal_code,
      country: capture.country,
      created_by: createdBy,
    })
    .select('*, job_orders(name)')
    .single()

  if (error) throw new Error(error.message)
  return mapReceiptRow(data as ReceiptRow)
}

export async function updateReceipt(id: string, input: Partial<ReceiptCreateInput>): Promise<Receipt> {
  const payload: Record<string, unknown> = {}
  if (input.receipt_date !== undefined) payload.receipt_date = input.receipt_date
  if (input.order_id !== undefined) payload.order_id = input.order_id
  if (input.expense_name !== undefined) payload.expense_name = input.expense_name.trim()
  if (input.amount !== undefined) payload.amount = input.amount ?? null
  if (input.supplier !== undefined) payload.supplier = input.supplier?.trim() || null
  if (input.note !== undefined) payload.note = input.note?.trim() || null

  const { data, error } = await supabase
    .from('receipts')
    .update(payload)
    .eq('id', id)
    .select('*, job_orders(name)')
    .single()

  if (error) throw new Error(error.message)
  return mapReceiptRow(data as ReceiptRow)
}

export async function deleteReceipt(id: string, filePath: string): Promise<void> {
  await supabase.storage.from('receipt-photos').remove([filePath])
  const { error } = await supabase.from('receipts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function openReceiptPhoto(filePath: string): Promise<void> {
  const { data, error } = await supabase.storage.from('receipt-photos').download(filePath)
  if (error || !data) throw new Error(error?.message ?? 'Otevření se nezdařilo')

  const url = URL.createObjectURL(data)
  window.open(url, '_blank')
}

export async function downloadReceiptPhoto(filePath: string, fileName: string): Promise<void> {
  const { data, error } = await supabase.storage.from('receipt-photos').download(filePath)
  if (error || !data) throw new Error(error?.message ?? 'Stažení se nezdařilo')

  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

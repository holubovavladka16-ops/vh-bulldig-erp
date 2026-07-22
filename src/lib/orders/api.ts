import { supabase } from '@/lib/supabase'
import { ensureProjectMapMarkerForOrder } from '@/lib/zakazkyMapa/createProjectMapMarker'
import { notifyMapOrdersChanged } from '@/lib/zakazkyMapa/mapEvents'
import {
  forceRedMarkerWithoutDiary,
  recalculateProjectMarkerColor,
} from '@/lib/zakazkyMapa/recalculateMarkerColor'
import type {
  JobOrder,
  JobOrderCreateInput,
  JobOrderDetail,
  JobOrderDocument,
  JobOrderFilters,
  JobOrderPhoto,
  ActiveJobOrderOption,
} from '@/types/orders'

export async function fetchJobOrders(filters: JobOrderFilters = {}): Promise<JobOrder[]> {
  let query = supabase.from('job_orders').select('*')

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.location?.trim()) query = query.ilike('location', `%${filters.location.trim()}%`)
  if (filters.dateFrom) query = query.gte('start_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('end_date', filters.dateTo)

  const { data, error } = await query.order('start_date', { ascending: false })
  if (error) throw new Error(error.message)

  let rows = (data ?? []) as JobOrder[]

  if (filters.search?.trim()) {
    const q = filters.search.toLowerCase().trim()
    rows = rows.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.location.toLowerCase().includes(q) ||
        (o.order_number ?? '').toLowerCase().includes(q)
    )
  }

  return rows
}

export async function fetchActiveJobOrders(): Promise<ActiveJobOrderOption[]> {
  const { data, error } = await supabase
    .from('job_orders')
    .select('id, name, location')
    .eq('status', 'aktivni')
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as ActiveJobOrderOption[]
}

export async function portalGetActiveOrders(token: string): Promise<ActiveJobOrderOption[]> {
  const { data, error } = await supabase.rpc('portal_get_active_orders', { p_token: token })
  if (error) throw new Error(error.message)
  return (data ?? []) as ActiveJobOrderOption[]
}

export async function fetchJobOrder(id: string): Promise<JobOrder | null> {
  const { data, error } = await supabase.from('job_orders').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data as JobOrder | null
}

export async function fetchJobOrderDetail(id: string): Promise<JobOrderDetail> {
  const { data, error } = await supabase.rpc('get_job_order_detail', { p_order_id: id })
  if (error) throw new Error(error.message)
  return data as JobOrderDetail
}

export async function createJobOrder(input: JobOrderCreateInput, createdBy: string): Promise<JobOrder> {
  const { data, error } = await supabase
    .from('job_orders')
    .insert({ ...input, created_by: createdBy })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  const order = data as JobOrder
  await ensureProjectMapMarkerForOrder(order)
  await forceRedMarkerWithoutDiary(order.id)
  await recalculateProjectMarkerColor(order.id)
  notifyMapOrdersChanged()
  return order
}

export async function updateJobOrder(id: string, input: Partial<JobOrderCreateInput>): Promise<JobOrder> {
  const { data, error } = await supabase.from('job_orders').update(input).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  const order = data as JobOrder

  const locationChanged =
    input.location != null ||
    input.gps_lat != null ||
    input.gps_lng != null ||
    input.gps_accuracy != null

  if (locationChanged) {
    await ensureProjectMapMarkerForOrder(order)
  }

  if (
    input.start_date != null ||
    input.end_date != null ||
    locationChanged
  ) {
    await recalculateProjectMarkerColor(id)
  }

  if (locationChanged) {
    notifyMapOrdersChanged()
  }

  return order
}

export async function archiveJobOrder(id: string): Promise<void> {
  const { error } = await supabase
    .from('job_orders')
    .update({ status: 'archivovana' })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteJobOrder(id: string): Promise<void> {
  const docs = await fetchJobOrderDocuments(id)
  const photos = await fetchJobOrderPhotos(id)

  for (const doc of docs) {
    await supabase.storage.from('order-documents').remove([doc.file_path])
  }
  for (const photo of photos) {
    await supabase.storage.from('order-photos').remove([photo.file_path])
  }

  const { error } = await supabase.from('job_orders').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchJobOrderDocuments(orderId: string): Promise<JobOrderDocument[]> {
  const { data, error } = await supabase
    .from('job_order_documents')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as JobOrderDocument[]
}

export async function fetchJobOrderPhotos(orderId: string): Promise<JobOrderPhoto[]> {
  const { data, error } = await supabase
    .from('job_order_photos')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as JobOrderPhoto[]
}

export async function uploadJobOrderDocument(
  orderId: string,
  title: string,
  file: File,
  uploadedBy: string
): Promise<JobOrderDocument> {
  const path = `${orderId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('order-documents').upload(path, file)
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await supabase
    .from('job_order_documents')
    .insert({
      order_id: orderId,
      title,
      file_path: path,
      file_name: file.name,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as JobOrderDocument
}

export async function deleteJobOrderDocument(doc: JobOrderDocument): Promise<void> {
  await supabase.storage.from('order-documents').remove([doc.file_path])
  const { error } = await supabase.from('job_order_documents').delete().eq('id', doc.id)
  if (error) throw new Error(error.message)
}

export async function uploadJobOrderPhoto(
  orderId: string,
  file: File,
  uploadedBy: string
): Promise<JobOrderPhoto> {
  const path = `${orderId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('order-photos').upload(path, file)
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await supabase
    .from('job_order_photos')
    .insert({
      order_id: orderId,
      file_path: path,
      file_name: file.name,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as JobOrderPhoto
}

export async function deleteJobOrderPhoto(photo: JobOrderPhoto): Promise<void> {
  await supabase.storage.from('order-photos').remove([photo.file_path])
  const { error } = await supabase.from('job_order_photos').delete().eq('id', photo.id)
  if (error) throw new Error(error.message)
}

export function getOrderDocumentUrl(filePath: string): string {
  const { data } = supabase.storage.from('order-documents').getPublicUrl(filePath)
  return data.publicUrl
}

export async function downloadOrderDocument(filePath: string, fileName: string): Promise<void> {
  const { data, error } = await supabase.storage.from('order-documents').download(filePath)
  if (error || !data) throw new Error(error?.message ?? 'Stažení se nezdařilo')

  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export async function openOrderDocument(filePath: string): Promise<void> {
  const { data, error } = await supabase.storage.from('order-documents').download(filePath)
  if (error || !data) throw new Error(error?.message ?? 'Otevření se nezdařilo')

  const url = URL.createObjectURL(data)
  window.open(url, '_blank')
}

export function getOrderPhotoUrl(filePath: string): string {
  const { data } = supabase.storage.from('order-photos').getPublicUrl(filePath)
  return data.publicUrl
}

export async function fetchJobOrderOptions(): Promise<{ value: string; label: string }[]> {
  const orders = await fetchJobOrders()
  return orders.map((o) => ({ value: o.id, label: o.name }))
}

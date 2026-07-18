import { supabase } from '@/lib/supabase'
import {
  createConstructionPoint,
} from '@/lib/constructionPoints/api'
import type {
  GpsPhoto,
  GpsPhotoCreateInput,
  GpsPhotoDetail,
  GpsPhotoFilters,
  GpsPhotoHistoryEntry,
} from '@/types/photos'

type GpsPhotoRow = GpsPhoto & {
  job_orders: { name: string } | null
  workers: { first_name: string; last_name: string } | null
  creator: { full_name: string; email: string } | null
}

function mapPhotoRow(row: GpsPhotoRow): GpsPhoto {
  return {
    id: row.id,
    file_path: row.file_path,
    file_name: row.file_name,
    captured_at: row.captured_at,
    captured_date: row.captured_date,
    captured_time: row.captured_time,
    gps_lat: Number(row.gps_lat),
    gps_lng: Number(row.gps_lng),
    gps_accuracy: row.gps_accuracy != null ? Number(row.gps_accuracy) : null,
    device_heading: row.device_heading != null ? Number(row.device_heading) : null,
    address_full: row.address_full,
    street: row.street,
    city: row.city,
    postal_code: row.postal_code,
    country: row.country,
    note: row.note,
    order_id: row.order_id,
    worker_id: row.worker_id,
    report_id: row.report_id,
    diary_entry_id: row.diary_entry_id,
  utility_connection_id: row.utility_connection_id ?? null,
  photo_phase: row.photo_phase ?? null,
    construction_point_id: row.construction_point_id ?? null,
    sort_order: Number(row.sort_order ?? 0),
  order_name: row.job_orders?.name ?? row.order_name,
    worker_name: row.workers ? `${row.workers.last_name} ${row.workers.first_name}` : row.worker_name,
    creator_name: row.creator?.full_name?.trim() || row.creator?.email || undefined,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function formatTimeValue(date: Date): string {
  return date.toTimeString().slice(0, 8)
}

export function getGpsPhotoUrl(filePath: string): string {
  const { data } = supabase.storage.from('gps-photos').getPublicUrl(filePath)
  return data.publicUrl
}

export async function fetchGpsPhotoBlob(filePath: string): Promise<Blob> {
  const url = getGpsPhotoUrl(filePath)
  const response = await fetch(url)
  if (!response.ok) throw new Error('Načtení fotografie se nezdařilo.')
  return response.blob()
}

export async function downloadGpsPhoto(filePath: string, fileName: string): Promise<void> {
  const blob = await fetchGpsPhotoBlob(filePath)
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  window.setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  }, 1500)
}

export async function fetchGpsPhotos(filters: GpsPhotoFilters = {}): Promise<GpsPhoto[]> {
  let query = supabase
    .from('gps_photos')
    .select('*, job_orders(name), workers(first_name, last_name), creator:profiles!gps_photos_created_by_fkey(full_name, email)')
    .order('captured_at', { ascending: false })

  if (filters.orderId) query = query.eq('order_id', filters.orderId)
  if (filters.workerId) query = query.eq('worker_id', filters.workerId)
  if (filters.dateFrom) query = query.gte('captured_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('captured_date', filters.dateTo)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as GpsPhotoRow[]).map(mapPhotoRow)
}

export async function fetchGpsPhotosByIds(ids: string[]): Promise<GpsPhoto[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('gps_photos')
    .select('*, job_orders(name), workers(first_name, last_name), creator:profiles!gps_photos_created_by_fkey(full_name, email)')
    .in('id', ids)
    .order('captured_at', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as GpsPhotoRow[]).map(mapPhotoRow)
}

export async function fetchGpsPhotoDetail(id: string): Promise<GpsPhotoDetail | null> {
  const { data, error } = await supabase
    .from('gps_photos')
    .select('*, job_orders(name), workers(first_name, last_name), creator:profiles!gps_photos_created_by_fkey(full_name, email)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const history = await fetchGpsPhotoHistory(id)
  return { ...mapPhotoRow(data as GpsPhotoRow), history }
}

async function fetchGpsPhotoHistory(photoId: string): Promise<GpsPhotoHistoryEntry[]> {
  const { data, error } = await supabase
    .from('gps_photo_history')
    .select('*')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as GpsPhotoHistoryEntry[]
}

async function addPhotoHistory(
  photoId: string,
  action: string,
  performedBy: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('gps_photo_history').insert({
    photo_id: photoId,
    action,
    details: details ?? null,
    performed_by: performedBy,
  })
  if (error) throw new Error(error.message)
}

export async function createGpsPhoto(input: GpsPhotoCreateInput, createdBy: string): Promise<GpsPhoto> {
  const capturedAt = input.captured_at
  const path = `${capturedAt.getFullYear()}/${Date.now()}_${input.file.name}`
  const { error: uploadError } = await supabase.storage.from('gps-photos').upload(path, input.file)
  if (uploadError) throw new Error(uploadError.message)

  let constructionPointId = input.construction_point_id ?? null
  let sortOrder = 0

  if (constructionPointId) {
    const { data: maxRow, error: maxError } = await supabase
      .from('gps_photos')
      .select('sort_order')
      .eq('construction_point_id', constructionPointId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (maxError) throw new Error(maxError.message)
    sortOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1
  } else {
    const point = await createConstructionPoint({
      order_id: input.order_id ?? null,
      gps_lat: input.gps_lat,
      gps_lng: input.gps_lng,
      gps_accuracy: input.gps_accuracy,
      address_full: input.address_full,
      street: input.street,
      city: input.city,
      postal_code: input.postal_code,
      country: input.country,
      created_by: createdBy,
    })
    constructionPointId = point.id
    sortOrder = 0
  }

  const { data, error } = await supabase
    .from('gps_photos')
    .insert({
      file_path: path,
      file_name: input.file.name,
      captured_at: capturedAt.toISOString(),
      captured_date: capturedAt.toISOString().slice(0, 10),
      captured_time: formatTimeValue(capturedAt),
      gps_lat: input.gps_lat,
      gps_lng: input.gps_lng,
      gps_accuracy: input.gps_accuracy,
      device_heading: input.device_heading ?? null,
      address_full: input.address_full,
      street: input.street,
      city: input.city,
      postal_code: input.postal_code,
      country: input.country,
      note: input.note?.trim() || null,
      order_id: input.order_id ?? null,
      worker_id: input.worker_id ?? null,
      report_id: input.report_id ?? null,
      diary_entry_id: input.diary_entry_id ?? null,
      utility_connection_id: input.utility_connection_id ?? null,
      photo_phase: input.photo_phase ?? null,
      construction_point_id: constructionPointId,
      sort_order: sortOrder,
      created_by: createdBy,
    })
    .select('*, job_orders(name), workers(first_name, last_name), creator:profiles!gps_photos_created_by_fkey(full_name, email)')
    .single()

  if (error) throw new Error(error.message)

  const photo = mapPhotoRow(data as GpsPhotoRow)
  await addPhotoHistory(photo.id, 'Fotografie pořízena', createdBy, {
    captured_at: photo.captured_at,
    address_full: photo.address_full,
    gps_lat: photo.gps_lat,
    gps_lng: photo.gps_lng,
    device_heading: photo.device_heading,
    construction_point_id: constructionPointId,
  })

  if (constructionPointId && input.construction_point_id) {
    const { error: histError } = await supabase.from('construction_point_history').insert({
      point_id: constructionPointId,
      action: 'Fotografie přidána do bodu',
      performed_by: createdBy,
      details: { photo_id: photo.id, file_name: photo.file_name },
    })
    if (histError) throw new Error(histError.message)
  }

  return photo
}

export async function updateGpsPhotoNote(id: string, note: string, performedBy: string): Promise<void> {
  const { error } = await supabase.from('gps_photos').update({ note: note.trim() || null }).eq('id', id)
  if (error) throw new Error(error.message)
  await addPhotoHistory(id, 'Poznámka upravena', performedBy, { note })
}

export async function updateGpsPhotoLinks(
  id: string,
  links: { order_id?: string | null; worker_id?: string | null; report_id?: string | null; diary_entry_id?: string | null },
  performedBy: string
): Promise<void> {
  const { error } = await supabase.from('gps_photos').update(links).eq('id', id)
  if (error) throw new Error(error.message)
  await addPhotoHistory(id, 'Propojení upraveno', performedBy, links)
}

export async function logGpsPhotoShare(id: string, channel: string, performedBy: string): Promise<void> {
  await addPhotoHistory(id, 'Fotografie sdílena', performedBy, { channel })
}

export async function deleteGpsPhoto(id: string, filePath: string, performedBy: string): Promise<void> {
  await addPhotoHistory(id, 'Fotografie smazána', performedBy)
  await supabase.storage.from('gps-photos').remove([filePath])
  const { error } = await supabase.from('gps_photos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchReportOptions(): Promise<{ value: string; label: string }[]> {
  const { data, error } = await supabase
    .from('worker_reports')
    .select('id, report_date, order_name, workers(first_name, last_name)')
    .order('report_date', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<Record<string, unknown> & { workers?: { first_name: string; last_name: string } | null }>).map((row) => {
    const worker = row.workers as { first_name: string; last_name: string } | null
    const workerName = worker ? `${worker.last_name} ${worker.first_name}` : 'Neznámý'
    return {
      value: row.id as string,
      label: `${row.report_date} · ${workerName} · ${row.order_name || '—'}`,
    }
  })
}

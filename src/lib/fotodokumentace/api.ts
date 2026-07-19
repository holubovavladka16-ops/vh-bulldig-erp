import { supabase } from '@/lib/supabase'
import { getMapyCzUrl } from '@/lib/photos/mapLinks'
import type {
  FotoAdresa,
  FotoAuditEntry,
  FotoDokument,
  FotoFiltry,
  FotoSerie,
  FotoTyp,
  FotoUlozitVstup,
} from '@/types/fotodokumentace'
import { buildStoragePaths, uploadFotoFiles } from '@/lib/fotodokumentace/storage'
import { generateFotoFileName } from '@/lib/fotodokumentace/naming'

type FotoRow = FotoDokument & {
  job_orders: { name: string } | null
  workers: { first_name: string; last_name: string } | null
  creator: { full_name: string; email: string } | null
}

function mapRow(row: FotoRow): FotoDokument {
  return {
    id: row.id,
    file_path: row.file_path,
    file_name: row.file_name,
    thumbnail_path: row.thumbnail_path ?? null,
    original_file_path: row.original_file_path ?? row.file_path,
    watermarked_file_path: row.watermarked_file_path ?? null,
    captured_at: row.captured_at,
    captured_date: row.captured_date,
    captured_time: row.captured_time,
    uploaded_at: row.uploaded_at ?? null,
    gps_lat: row.gps_lat != null ? Number(row.gps_lat) : null,
    gps_lng: row.gps_lng != null ? Number(row.gps_lng) : null,
    gps_accuracy: row.gps_accuracy != null ? Number(row.gps_accuracy) : null,
    gps_status: row.gps_status ?? 'verified',
    device_heading: row.device_heading != null ? Number(row.device_heading) : null,
    address_full: row.address_full,
    street: row.street,
    city: row.city,
    postal_code: row.postal_code,
    district: row.district ?? '',
    region: row.region ?? '',
    country: row.country,
    map_url: row.map_url ?? null,
    note: row.note,
    photo_type: row.photo_type ?? null,
    order_id: row.order_id,
    worker_id: row.worker_id,
    report_id: row.report_id,
    diary_entry_id: row.diary_entry_id,
    utility_connection_id: row.utility_connection_id ?? null,
    series_id: row.series_id ?? null,
    paired_photo_id: row.paired_photo_id ?? null,
    approval_status: row.approval_status ?? 'nova',
    sync_status: row.sync_status ?? null,
    sort_order: Number(row.sort_order ?? 0),
    order_name: row.job_orders?.name ?? row.order_name,
    worker_name: row.workers
      ? `${row.workers.last_name} ${row.workers.first_name}`
      : row.worker_name,
    creator_name: row.creator?.full_name?.trim() || row.creator?.email || undefined,
    created_by: row.created_by,
    approved_by: row.approved_by ?? null,
    approved_at: row.approved_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  }
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 8)
}

const SELECT_QUERY =
  '*, job_orders(name), workers(first_name, last_name), creator:profiles!gps_photos_created_by_fkey(full_name, email)'

export function getFotoUrl(filePath: string | null | undefined): string {
  if (!filePath) return ''
  const { data } = supabase.storage.from('gps-photos').getPublicUrl(filePath)
  return data.publicUrl
}

function applyFilters(query: ReturnType<typeof supabase.from>, filters: FotoFiltry) {
  let q = query
  if (!filters.includeDeleted) q = q.is('deleted_at', null)
  if (filters.orderId) q = q.eq('order_id', filters.orderId)
  if (filters.workerId) q = q.eq('worker_id', filters.workerId)
  if (filters.photoType) q = q.eq('photo_type', filters.photoType)
  if (filters.dateFrom) q = q.gte('captured_date', filters.dateFrom)
  if (filters.dateTo) q = q.lte('captured_date', filters.dateTo)
  if (filters.dateExact) q = q.eq('captured_date', filters.dateExact)
  if (filters.hasGps) q = q.not('gps_lat', 'is', null)
  if (filters.noGps) q = q.is('gps_lat', null)
  if (filters.approvalStatus) q = q.eq('approval_status', filters.approvalStatus)
  if (filters.seriesId) q = q.eq('series_id', filters.seriesId)
  if (filters.addressQuery?.trim()) {
    q = q.ilike('address_full', `%${filters.addressQuery.trim()}%`)
  }
  if (filters.cityQuery?.trim()) {
    q = q.ilike('city', `%${filters.cityQuery.trim()}%`)
  }
  return q
}

export async function fetchFotodokumenty(filters: FotoFiltry = {}): Promise<FotoDokument[]> {
  let query = supabase
    .from('gps_photos')
    .select(SELECT_QUERY)
    .order('captured_at', { ascending: false })

  query = applyFilters(query, filters)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as FotoRow[]).map(mapRow)
}

export async function fetchFotodokument(id: string): Promise<FotoDokument | null> {
  const { data, error } = await supabase
    .from('gps_photos')
    .select(SELECT_QUERY)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as FotoRow) : null
}

export async function fetchFotoTypy(): Promise<FotoTyp[]> {
  const { data, error } = await supabase
    .from('gps_photo_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    return []
  }
  return (data ?? []) as FotoTyp[]
}

export async function fetchFotoAudit(photoId: string): Promise<FotoAuditEntry[]> {
  const { data, error } = await supabase
    .from('gps_photo_audit_log')
    .select('*, performer:profiles!gps_photo_audit_log_performed_by_fkey(full_name, email)')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: false })

  if (error) return []

  return ((data ?? []) as Array<FotoAuditEntry & { performer?: { full_name: string; email: string } }>).map(
    (row) => ({
      ...row,
      performer_name: row.performer?.full_name?.trim() || row.performer?.email || undefined,
    })
  )
}

async function writeAudit(
  photoId: string,
  action: string,
  performedBy: string,
  details?: { field_name?: string; old_value?: string; new_value?: string; reason?: string }
): Promise<void> {
  const { error } = await supabase.from('gps_photo_audit_log').insert({
    photo_id: photoId,
    action,
    field_name: details?.field_name ?? null,
    old_value: details?.old_value ?? null,
    new_value: details?.new_value ?? null,
    reason: details?.reason ?? null,
    performed_by: performedBy,
  })
  if (error) return
}

function isMissingColumnError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('schema cache') || m.includes('could not find') || m.includes('column')
}

function buildLegacyInsertPayload(
  input: FotoUlozitVstup,
  paths: ReturnType<typeof buildStoragePaths>,
  fileName: string,
  capturedAt: Date,
  createdBy: string
) {
  return {
    file_path: paths.display,
    file_name: fileName,
    captured_at: capturedAt.toISOString(),
    captured_date: capturedAt.toISOString().slice(0, 10),
    captured_time: formatTime(capturedAt),
    gps_lat: input.gps_lat ?? 0,
    gps_lng: input.gps_lng ?? 0,
    gps_accuracy: input.gps_accuracy,
    device_heading: input.device_heading ?? null,
    address_full: input.address.address_full,
    street: input.address.street,
    city: input.address.city,
    postal_code: input.address.postal_code,
    country: input.address.country,
    note: input.note?.trim() || null,
    order_id: input.order_id,
    worker_id: input.worker_id ?? null,
    report_id: input.report_id ?? null,
    diary_entry_id: input.diary_entry_id ?? null,
    utility_connection_id: input.utility_connection_id ?? null,
    sort_order: 0,
    created_by: createdBy,
  }
}

function buildFullInsertPayload(
  input: FotoUlozitVstup,
  paths: ReturnType<typeof buildStoragePaths>,
  fileName: string,
  capturedAt: Date,
  createdBy: string,
  mapUrl: string | null
) {
  return {
    file_path: paths.display,
    file_name: fileName,
    original_file_path: paths.original,
    thumbnail_path: paths.thumbnail,
    watermarked_file_path: paths.watermarked,
    captured_at: capturedAt.toISOString(),
    captured_date: capturedAt.toISOString().slice(0, 10),
    captured_time: formatTime(capturedAt),
    uploaded_at: new Date().toISOString(),
    gps_lat: input.gps_lat,
    gps_lng: input.gps_lng,
    gps_accuracy: input.gps_accuracy,
    gps_status: input.gps_status,
    device_heading: input.device_heading ?? null,
    address_full: input.address.address_full,
    street: input.address.street,
    city: input.address.city,
    postal_code: input.address.postal_code,
    district: input.address.district,
    region: input.address.region,
    country: input.address.country,
    map_url: mapUrl,
    note: input.note?.trim() || null,
    photo_type: input.photo_type ?? null,
    order_id: input.order_id,
    worker_id: input.worker_id ?? null,
    report_id: input.report_id ?? null,
    diary_entry_id: input.diary_entry_id ?? null,
    utility_connection_id: input.utility_connection_id ?? null,
    series_id: input.series_id ?? null,
    approval_status: 'nova',
    sync_status: 'synced',
    sort_order: 0,
    created_by: createdBy,
  }
}

export async function ulozitFotodokument(
  input: FotoUlozitVstup,
  createdBy: string,
  orderName: string
): Promise<FotoDokument> {
  const capturedAt = input.captured_at
  const fileName = await generateFotoFileName({
    date: capturedAt,
    orderName,
    photoType: input.photo_type,
    orderId: input.order_id,
  })

  const paths = buildStoragePaths(input.order_id, capturedAt, fileName)
  await uploadFotoFiles(paths, {
    original: input.file,
    thumbnail: input.thumbnail,
    watermarked: input.watermarked,
  })

  const mapUrl =
    input.map_url ??
    (input.gps_lat != null && input.gps_lng != null
      ? getMapyCzUrl(input.gps_lat, input.gps_lng)
      : null)

  const fullPayload = buildFullInsertPayload(
    input,
    paths,
    fileName,
    capturedAt,
    createdBy,
    mapUrl
  )

  let result = await supabase.from('gps_photos').insert(fullPayload).select(SELECT_QUERY).single()

  if (result.error && isMissingColumnError(result.error.message)) {
    const legacyPayload = buildLegacyInsertPayload(input, paths, fileName, capturedAt, createdBy)
    result = await supabase.from('gps_photos').insert(legacyPayload).select(SELECT_QUERY).single()
  }

  const { data, error } = result
  if (error) throw new Error(error.message)

  const foto = mapRow(data as FotoRow)
  try {
    await writeAudit(foto.id, 'Fotografie vytvořena', createdBy)
  } catch {
    // audit tabulka nemusí existovat před migrací 062
  }
  return foto
}

export async function upravitFotodokument(
  id: string,
  updates: Partial<{
    note: string | null
    photo_type: string | null
    order_id: string | null
    address: FotoAdresa
    gps_lat: number | null
    gps_lng: number | null
    gps_status: string
    approval_status: string
    paired_photo_id: string | null
  }>,
  performedBy: string,
  reason?: string
): Promise<void> {
  const payload: Record<string, unknown> = {}

  if ('note' in updates) payload.note = updates.note
  if ('photo_type' in updates) payload.photo_type = updates.photo_type
  if ('order_id' in updates) payload.order_id = updates.order_id
  if ('paired_photo_id' in updates) payload.paired_photo_id = updates.paired_photo_id
  if ('approval_status' in updates) {
    payload.approval_status = updates.approval_status
    if (updates.approval_status === 'schvalena') {
      payload.approved_by = performedBy
      payload.approved_at = new Date().toISOString()
    }
  }
  if (updates.address) {
    payload.address_full = updates.address.address_full
    payload.street = updates.address.street
    payload.city = updates.address.city
    payload.postal_code = updates.address.postal_code
    payload.district = updates.address.district
    payload.region = updates.address.region
    payload.country = updates.address.country
  }
  if ('gps_lat' in updates) payload.gps_lat = updates.gps_lat
  if ('gps_lng' in updates) payload.gps_lng = updates.gps_lng
  if ('gps_status' in updates) payload.gps_status = updates.gps_status
  if (updates.gps_lat != null && updates.gps_lng != null) {
    payload.map_url = getMapyCzUrl(updates.gps_lat, updates.gps_lng)
  }

  const { error } = await supabase.from('gps_photos').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  await writeAudit(id, 'Fotografie upravena', performedBy, { reason })
}

export async function smazatFotodokument(
  id: string,
  performedBy: string,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('gps_photos')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: performedBy,
      delete_reason: reason?.trim() || null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  await writeAudit(id, 'Fotografie smazána (koš)', performedBy, { reason })
}

export async function obnovitFotodokument(id: string, performedBy: string): Promise<void> {
  const { error } = await supabase
    .from('gps_photos')
    .update({ deleted_at: null, deleted_by: null, delete_reason: null })
    .eq('id', id)

  if (error) throw new Error(error.message)
  await writeAudit(id, 'Fotografie obnovena', performedBy)
}

export async function vytvoritSerii(
  name: string,
  orderId: string | null,
  createdBy: string,
  note?: string
): Promise<FotoSerie> {
  const { data, error } = await supabase
    .from('gps_photo_series')
    .insert({
      name,
      order_id: orderId,
      note: note?.trim() || null,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as FotoSerie
}

export async function propojitSPripojkou(
  photoId: string,
  connectionId: string,
  performedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('gps_photos')
    .update({ utility_connection_id: connectionId })
    .eq('id', photoId)

  if (error) throw new Error(error.message)
  await writeAudit(photoId, 'Přiřazeno k přípojce', performedBy, {
    new_value: connectionId,
  })
}

export async function propojitSDenikem(
  photoId: string,
  diaryEntryId: string,
  performedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('gps_photos')
    .update({ diary_entry_id: diaryEntryId })
    .eq('id', photoId)

  if (error) throw new Error(error.message)
  await writeAudit(photoId, 'Přidáno do stavebního deníku', performedBy, {
    new_value: diaryEntryId,
  })
}

export async function schvalitFotodokument(
  id: string,
  status: 'schvalena' | 'zamitnuta' | 'ke_kontrole',
  performedBy: string,
  reason?: string
): Promise<void> {
  await upravitFotodokument(id, { approval_status: status }, performedBy, reason)
  await writeAudit(id, `Stav schválení: ${status}`, performedBy, { reason })
}

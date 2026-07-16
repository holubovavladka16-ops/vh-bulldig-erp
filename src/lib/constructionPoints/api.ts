import { supabase } from '@/lib/supabase'
import type { GpsPhoto, GpsPhotoHistoryEntry } from '@/types/photos'
import type {
  ConstructionPoint,
  ConstructionPointDetail,
  ConstructionPointFilters,
  ConstructionPointHistoryEntry,
  ConstructionPointNote,
  ConstructionPointUpdateInput,
} from '@/types/constructionPoints'

type PointRow = ConstructionPoint & {
  job_orders: { name: string } | null
  creator: { full_name: string; email: string } | null
  gps_photos: { count: number }[] | { count: number } | null
}

function mapPointRow(row: PointRow): ConstructionPoint {
  const photoCountRaw = row.gps_photos
  const photo_count =
    photoCountRaw == null
      ? 0
      : Array.isArray(photoCountRaw)
        ? photoCountRaw[0]?.count ?? 0
        : photoCountRaw.count ?? 0

  return {
    id: row.id,
    point_number: row.point_number,
    name: row.name,
    order_id: row.order_id,
    gps_lat: Number(row.gps_lat),
    gps_lng: Number(row.gps_lng),
    gps_accuracy: row.gps_accuracy != null ? Number(row.gps_accuracy) : null,
    address_full: row.address_full,
    street: row.street,
    city: row.city,
    postal_code: row.postal_code,
    country: row.country,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    order_name: row.job_orders?.name,
    creator_name: row.creator?.full_name?.trim() || row.creator?.email,
    photo_count,
  }
}

async function addPointHistory(
  pointId: string,
  action: string,
  performedBy: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('construction_point_history').insert({
    point_id: pointId,
    action,
    details: details ?? null,
    performed_by: performedBy,
  })
  if (error) throw new Error(error.message)
}

export async function getNextPointNumber(orderId: string | null): Promise<number> {
  let query = supabase.from('construction_points').select('point_number').order('point_number', { ascending: false }).limit(1)
  if (orderId) query = query.eq('order_id', orderId)
  else query = query.is('order_id', null)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  const row = (data ?? [])[0] as { point_number: number } | undefined
  return (row?.point_number ?? 0) + 1
}

export interface CreateConstructionPointInput {
  order_id?: string | null
  gps_lat: number
  gps_lng: number
  gps_accuracy?: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
  name?: string
  created_by: string
}

export async function createConstructionPoint(
  input: CreateConstructionPointInput
): Promise<ConstructionPoint> {
  const pointNumber = await getNextPointNumber(input.order_id ?? null)
  const name = input.name?.trim() || `Stavební bod ${pointNumber}`

  const { data, error } = await supabase
    .from('construction_points')
    .insert({
      point_number: pointNumber,
      name,
      order_id: input.order_id ?? null,
      gps_lat: input.gps_lat,
      gps_lng: input.gps_lng,
      gps_accuracy: input.gps_accuracy ?? null,
      address_full: input.address_full,
      street: input.street,
      city: input.city,
      postal_code: input.postal_code,
      country: input.country,
      created_by: input.created_by,
    })
    .select('*, job_orders(name), creator:profiles!construction_points_created_by_fkey(full_name, email)')
    .single()

  if (error) throw new Error(error.message)

  const point = mapPointRow({ ...(data as PointRow), gps_photos: [{ count: 0 }] })
  await addPointHistory(point.id, 'Stavební bod vytvořen', input.created_by, {
    name: point.name,
    gps_lat: point.gps_lat,
    gps_lng: point.gps_lng,
  })
  return point
}

export async function fetchConstructionPoints(
  filters: ConstructionPointFilters = {}
): Promise<ConstructionPoint[]> {
  let query = supabase
    .from('construction_points')
    .select(
      '*, job_orders(name), creator:profiles!construction_points_created_by_fkey(full_name, email), gps_photos(count)'
    )
    .order('point_number', { ascending: true })

  if (filters.orderId) query = query.eq('order_id', filters.orderId)
  if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`)
  if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59`)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  let points = ((data ?? []) as PointRow[]).map(mapPointRow)

  if (filters.workerId) {
    const { data: photoRows, error: photoError } = await supabase
      .from('gps_photos')
      .select('construction_point_id')
      .eq('worker_id', filters.workerId)
      .not('construction_point_id', 'is', null)

    if (photoError) throw new Error(photoError.message)
    const allowed = new Set(
      (photoRows ?? [])
        .map((r) => r.construction_point_id as string)
        .filter(Boolean)
    )
    points = points.filter((p) => allowed.has(p.id))
  }

  return points
}

function mapPhotoFromRow(row: Record<string, unknown>): GpsPhoto {
  const jobOrders = row.job_orders as { name: string } | null
  const workers = row.workers as { first_name: string; last_name: string } | null
  const creator = row.creator as { full_name: string; email: string } | null

  return {
    id: row.id as string,
    file_path: row.file_path as string,
    file_name: row.file_name as string,
    captured_at: row.captured_at as string,
    captured_date: row.captured_date as string,
    captured_time: row.captured_time as string,
    gps_lat: Number(row.gps_lat),
    gps_lng: Number(row.gps_lng),
    gps_accuracy: row.gps_accuracy != null ? Number(row.gps_accuracy) : null,
    device_heading: row.device_heading != null ? Number(row.device_heading) : null,
    address_full: row.address_full as string,
    street: row.street as string,
    city: row.city as string,
    postal_code: row.postal_code as string,
    country: row.country as string,
    note: row.note as string | null,
    order_id: row.order_id as string | null,
    worker_id: row.worker_id as string | null,
    report_id: row.report_id as string | null,
    diary_entry_id: row.diary_entry_id as string | null,
    utility_connection_id: (row.utility_connection_id as string | null) ?? null,
    photo_phase: (row.photo_phase as 'pred' | 'po' | null) ?? null,
    construction_point_id: (row.construction_point_id as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    order_name: jobOrders?.name,
    worker_name: workers ? `${workers.last_name} ${workers.first_name}` : undefined,
    creator_name: creator?.full_name?.trim() || creator?.email,
    created_by: row.created_by as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function fetchConstructionPointDetail(id: string): Promise<ConstructionPointDetail | null> {
  const { data, error } = await supabase
    .from('construction_points')
    .select('*, job_orders(name), creator:profiles!construction_points_created_by_fkey(full_name, email)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const [photosRes, notesRes, historyRes] = await Promise.all([
    supabase
      .from('gps_photos')
      .select('*, job_orders(name), workers(first_name, last_name), creator:profiles!gps_photos_created_by_fkey(full_name, email)')
      .eq('construction_point_id', id)
      .order('sort_order', { ascending: true })
      .order('captured_at', { ascending: true }),
    supabase
      .from('construction_point_notes')
      .select('*, author:profiles!construction_point_notes_created_by_fkey(full_name, email)')
      .eq('point_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('construction_point_history')
      .select('*')
      .eq('point_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (photosRes.error) throw new Error(photosRes.error.message)
  if (notesRes.error) throw new Error(notesRes.error.message)
  if (historyRes.error) throw new Error(historyRes.error.message)

  const photos = (photosRes.data ?? []).map((row) => mapPhotoFromRow(row as Record<string, unknown>))

  const photoHistory: GpsPhotoHistoryEntry[] = []
  if (photos.length > 0) {
    const { data: phData, error: phError } = await supabase
      .from('gps_photo_history')
      .select('*')
      .in(
        'photo_id',
        photos.map((p) => p.id)
      )
      .order('created_at', { ascending: false })
    if (phError) throw new Error(phError.message)
    photoHistory.push(...((phData ?? []) as GpsPhotoHistoryEntry[]))
  }

  const notes: ConstructionPointNote[] = (notesRes.data ?? []).map((row) => {
    const r = row as ConstructionPointNote & {
      author: { full_name: string; email: string } | null
    }
    return {
      ...r,
      author_name: r.author?.full_name?.trim() || r.author?.email,
    }
  })

  const history = (historyRes.data ?? []) as ConstructionPointHistoryEntry[]

  return {
    ...mapPointRow({ ...(data as PointRow), gps_photos: [{ count: photos.length }] }),
    photos,
    notes,
    history,
    photo_history: photoHistory,
  }
}

export async function updateConstructionPoint(
  id: string,
  input: ConstructionPointUpdateInput,
  performedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('construction_points')
    .update(input as Record<string, unknown>)
    .eq('id', id)
  if (error) throw new Error(error.message)
  await addPointHistory(id, 'Stavební bod upraven', performedBy, input as Record<string, unknown>)
}

export async function deleteConstructionPoint(id: string, performedBy: string): Promise<void> {
  const detail = await fetchConstructionPointDetail(id)
  if (!detail) return

  for (const photo of detail.photos) {
    await removeGpsPhotoRecord(photo, performedBy)
  }

  await addPointHistory(id, 'Stavební bod smazán', performedBy, {
    photo_count: detail.photos.length,
  })

  const { error } = await supabase.from('construction_points').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function createConstructionPointNote(
  pointId: string,
  content: string,
  createdBy: string
): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Poznámka nemůže být prázdná.')

  const { error } = await supabase.from('construction_point_notes').insert({
    point_id: pointId,
    content: trimmed,
    created_by: createdBy,
  })
  if (error) throw new Error(error.message)
  await addPointHistory(pointId, 'Poznámka přidána', createdBy, { content: trimmed })
}

export async function updateConstructionPointNote(
  noteId: string,
  pointId: string,
  content: string,
  performedBy: string
): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Poznámka nemůže být prázdná.')

  const { error } = await supabase
    .from('construction_point_notes')
    .update({ content: trimmed })
    .eq('id', noteId)
  if (error) throw new Error(error.message)
  await addPointHistory(pointId, 'Poznámka upravena', performedBy, { note_id: noteId, content: trimmed })
}

export async function deleteConstructionPointNote(
  noteId: string,
  pointId: string,
  performedBy: string
): Promise<void> {
  const { error } = await supabase.from('construction_point_notes').delete().eq('id', noteId)
  if (error) throw new Error(error.message)
  await addPointHistory(pointId, 'Poznámka smazána', performedBy, { note_id: noteId })
}

export async function reorderConstructionPointPhotos(
  pointId: string,
  photoIds: string[],
  performedBy: string
): Promise<void> {
  await Promise.all(
    photoIds.map((photoId, index) =>
      supabase
        .from('gps_photos')
        .update({ sort_order: index })
        .eq('id', photoId)
        .eq('construction_point_id', pointId)
    )
  )
  await addPointHistory(pointId, 'Pořadí fotografií změněno', performedBy, { order: photoIds })
}

export async function deletePhotoFromPoint(
  photo: GpsPhoto,
  pointId: string,
  performedBy: string
): Promise<void> {
  await removeGpsPhotoRecord(photo, performedBy)
  await addPointHistory(pointId, 'Fotografie smazána z bodu', performedBy, {
    photo_id: photo.id,
    file_name: photo.file_name,
  })
}

async function removeGpsPhotoRecord(photo: GpsPhoto, performedBy: string): Promise<void> {
  await supabase.from('gps_photo_history').insert({
    photo_id: photo.id,
    action: 'Fotografie smazána',
    performed_by: performedBy,
  })
  await supabase.storage.from('gps-photos').remove([photo.file_path])
  const { error } = await supabase.from('gps_photos').delete().eq('id', photo.id)
  if (error) throw new Error(error.message)
}

export function getGpsPhotoUrl(filePath: string): string {
  const { data } = supabase.storage.from('gps-photos').getPublicUrl(filePath)
  return data.publicUrl
}

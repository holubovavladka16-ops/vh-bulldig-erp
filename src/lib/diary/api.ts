import { supabase } from '@/lib/supabase'
import { recalculateProjectMarkerColor } from '@/lib/zakazkyMapa/recalculateMarkerColor'
import type {
  ConstructionDiaryCreateInput,
  ConstructionDiaryDetail,
  ConstructionDiaryEntry,
  ConstructionDiaryFilters,
  DiaryExportOptions,
} from '@/types/diary'
import type { GpsPhoto } from '@/types/photos'

type DiaryRow = ConstructionDiaryEntry & {
  job_orders: { name: string; order_number: string | null } | null
  creator?: { full_name: string | null; email: string | null } | null
}

const DIARY_ENTRY_SELECT =
  '*, job_orders(name, order_number), creator:profiles!construction_diary_entries_created_by_fkey(full_name, email)'

const PHOTO_SELECT = '*, job_orders(name), workers(first_name, last_name), creator:profiles!gps_photos_created_by_fkey(full_name, email)'

type GpsPhotoRow = GpsPhoto & {
  job_orders: { name: string } | null
  workers: { first_name: string; last_name: string } | null
  creator: { full_name: string; email: string } | null
}

function mapPhotoRow(row: GpsPhotoRow): GpsPhoto {
  return {
    ...row,
    gps_lat: Number(row.gps_lat),
    gps_lng: Number(row.gps_lng),
    gps_accuracy: row.gps_accuracy != null ? Number(row.gps_accuracy) : null,
    order_name: row.job_orders?.name ?? row.order_name,
    worker_name: row.workers ? `${row.workers.last_name} ${row.workers.first_name}` : row.worker_name,
    creator_name: row.creator?.full_name?.trim() || row.creator?.email || undefined,
  }
}

function mapDiaryRow(row: DiaryRow): ConstructionDiaryEntry {
  return {
    id: row.id,
    entry_number: row.entry_number != null ? Number(row.entry_number) : null,
    entry_date: row.entry_date,
    order_id: row.order_id,
    order_name: row.job_orders?.name ?? row.order_name,
    order_number: row.job_orders?.order_number ?? row.order_number ?? null,
    weather: row.weather,
    weather_type: row.weather_type ?? null,
    temperature_celsius: row.temperature_celsius != null ? Number(row.temperature_celsius) : null,
    site_location: row.site_location ?? '',
    worker_count: Number(row.worker_count),
    worker_names: row.worker_names,
    equipment: row.equipment,
    material: row.material ?? '',
    performances_summary: row.performances_summary ?? '',
    rough_work_description: row.rough_work_description ?? '',
    work_description: row.work_description,
    ai_work_description: row.ai_work_description ?? '',
    ai_assisted: Boolean(row.ai_assisted),
    note: row.note ?? '',
    extraordinary_events: row.extraordinary_events ?? '',
    entry_status: (row.entry_status as ConstructionDiaryEntry['entry_status']) ?? 'approved',
    creator_name:
      row.creator?.full_name?.trim() || row.creator?.email?.trim() || row.creator_name,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function fetchDiaryEntries(filters: ConstructionDiaryFilters = {}): Promise<ConstructionDiaryEntry[]> {
  let query = supabase
    .from('construction_diary_entries')
    .select(DIARY_ENTRY_SELECT)
    .order('entry_date', { ascending: false })

  if (filters.orderId) query = query.eq('order_id', filters.orderId)
  if (filters.dateFrom) query = query.gte('entry_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('entry_date', filters.dateTo)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as DiaryRow[]).map(mapDiaryRow)
}

async function fetchDiaryPhotos(diaryEntryId: string): Promise<GpsPhoto[]> {
  const { data, error } = await supabase
    .from('gps_photos')
    .select(PHOTO_SELECT)
    .eq('diary_entry_id', diaryEntryId)
    .order('captured_at', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as GpsPhotoRow[]).map(mapPhotoRow)
}

export async function fetchDiaryDetail(id: string): Promise<ConstructionDiaryDetail | null> {
  const { data, error } = await supabase
    .from('construction_diary_entries')
    .select(DIARY_ENTRY_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const photos = await fetchDiaryPhotos(id)
  return { ...mapDiaryRow(data as DiaryRow), photos }
}

export function buildExportFilters(options: DiaryExportOptions): ConstructionDiaryFilters {
  if (options.scope === 'order' && options.orderId) {
    return { orderId: options.orderId, dateFrom: options.dateFrom, dateTo: options.dateTo }
  }
  if (options.scope === 'period') {
    return { dateFrom: options.dateFrom, dateTo: options.dateTo, orderId: options.orderId }
  }
  return { orderId: options.orderId, dateFrom: options.dateFrom, dateTo: options.dateTo }
}

export async function fetchDiaryDetailsForExport(options: DiaryExportOptions): Promise<ConstructionDiaryDetail[]> {
  const entries = await fetchDiaryEntries(buildExportFilters(options))
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date, 'cs'))
  const details = await Promise.all(sorted.map((e) => fetchDiaryDetail(e.id)))
  return details.filter((d): d is ConstructionDiaryDetail => d != null)
}

async function syncDiaryPhotoLinks(diaryEntryId: string, orderId: string, photoIds: string[]): Promise<void> {
  const { error: unlinkError } = await supabase
    .from('gps_photos')
    .update({ diary_entry_id: null })
    .eq('diary_entry_id', diaryEntryId)

  if (unlinkError) throw new Error(unlinkError.message)

  if (photoIds.length === 0) return

  const { error } = await supabase
    .from('gps_photos')
    .update({ diary_entry_id: diaryEntryId, order_id: orderId })
    .in('id', photoIds)

  if (error) throw new Error(error.message)
}

function buildInsertPayload(input: ConstructionDiaryCreateInput, createdBy: string) {
  const { linked_photo_ids: _linked, ...rest } = input
  void _linked
  return {
    ...rest,
    worker_names: input.worker_names.trim(),
    equipment: input.equipment.trim(),
    material: input.material.trim(),
    performances_summary: input.performances_summary.trim(),
    rough_work_description: input.rough_work_description.trim(),
    work_description: input.work_description.trim(),
    ai_work_description: input.ai_work_description.trim(),
    ai_assisted: input.ai_assisted,
    note: input.note.trim(),
    extraordinary_events: input.extraordinary_events.trim(),
    weather: input.weather.trim(),
    site_location: input.site_location.trim(),
    created_by: createdBy,
  }
}

export async function createDiaryEntry(
  input: ConstructionDiaryCreateInput,
  createdBy: string
): Promise<ConstructionDiaryDetail> {
  const { data, error } = await supabase
    .from('construction_diary_entries')
    .insert(buildInsertPayload(input, createdBy))
    .select(DIARY_ENTRY_SELECT)
    .single()

  if (error) throw new Error(error.message)

  const entry = mapDiaryRow(data as DiaryRow)
  await syncDiaryPhotoLinks(entry.id, entry.order_id, input.linked_photo_ids ?? [])

  const detail = await fetchDiaryDetail(entry.id)
  if (!detail) throw new Error('Zápis se nepodařilo načíst')
  await recalculateProjectMarkerColor(entry.order_id)
  return detail
}

export async function updateDiaryEntry(
  id: string,
  input: ConstructionDiaryCreateInput
): Promise<ConstructionDiaryDetail> {
  const { linked_photo_ids: _linked, ...rest } = input
  void _linked

  const { data, error } = await supabase
    .from('construction_diary_entries')
    .update({
      entry_date: rest.entry_date,
      order_id: rest.order_id,
      weather: rest.weather.trim(),
      weather_type: rest.weather_type,
      temperature_celsius: rest.temperature_celsius,
      site_location: rest.site_location.trim(),
      worker_count: rest.worker_count,
      worker_names: rest.worker_names.trim(),
      equipment: rest.equipment.trim(),
      material: rest.material.trim(),
      performances_summary: rest.performances_summary.trim(),
      rough_work_description: rest.rough_work_description.trim(),
      work_description: rest.work_description.trim(),
      ai_work_description: rest.ai_work_description.trim(),
      ai_assisted: rest.ai_assisted,
      note: rest.note.trim(),
      extraordinary_events: rest.extraordinary_events.trim(),
    })
    .eq('id', id)
    .select(DIARY_ENTRY_SELECT)
    .single()

  if (error) throw new Error(error.message)

  const entry = mapDiaryRow(data as DiaryRow)
  await syncDiaryPhotoLinks(entry.id, entry.order_id, input.linked_photo_ids ?? [])

  const detail = await fetchDiaryDetail(entry.id)
  if (!detail) throw new Error('Zápis se nepodařilo načíst')
  await recalculateProjectMarkerColor(entry.order_id)
  return detail
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  const { data: existing } = await supabase
    .from('construction_diary_entries')
    .select('order_id')
    .eq('id', id)
    .maybeSingle()

  await supabase.from('gps_photos').update({ diary_entry_id: null }).eq('diary_entry_id', id)

  const { error } = await supabase.from('construction_diary_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)

  const orderId = (existing as { order_id?: string } | null)?.order_id
  if (orderId) {
    await recalculateProjectMarkerColor(orderId)
  }
}

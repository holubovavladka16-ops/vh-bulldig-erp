import { supabase } from '@/lib/supabase'
import { createGpsPhoto } from '@/lib/photos/api'
import type {
  ConstructionDiaryCreateInput,
  ConstructionDiaryDetail,
  ConstructionDiaryEntry,
  ConstructionDiaryFilters,
  PendingDiaryPhoto,
} from '@/types/diary'
import type { GpsPhoto } from '@/types/photos'

type DiaryRow = ConstructionDiaryEntry & {
  job_orders: { name: string } | null
}

function mapDiaryRow(row: DiaryRow): ConstructionDiaryEntry {
  return {
    id: row.id,
    entry_date: row.entry_date,
    order_id: row.order_id,
    order_name: row.job_orders?.name ?? row.order_name,
    weather: row.weather,
    worker_count: Number(row.worker_count),
    worker_names: row.worker_names,
    equipment: row.equipment,
    work_description: row.work_description,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function fetchDiaryEntries(filters: ConstructionDiaryFilters = {}): Promise<ConstructionDiaryEntry[]> {
  let query = supabase
    .from('construction_diary_entries')
    .select('*, job_orders(name)')
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
    .select('*')
    .eq('diary_entry_id', diaryEntryId)
    .order('captured_at', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as GpsPhoto[]).map((row) => ({
    ...row,
    gps_lat: Number(row.gps_lat),
    gps_lng: Number(row.gps_lng),
    gps_accuracy: row.gps_accuracy != null ? Number(row.gps_accuracy) : null,
  }))
}

export async function fetchDiaryDetail(id: string): Promise<ConstructionDiaryDetail | null> {
  const { data, error } = await supabase
    .from('construction_diary_entries')
    .select('*, job_orders(name)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const photos = await fetchDiaryPhotos(id)
  return { ...mapDiaryRow(data as DiaryRow), photos }
}

export async function createDiaryEntry(
  input: ConstructionDiaryCreateInput,
  createdBy: string,
  photos: PendingDiaryPhoto[] = []
): Promise<ConstructionDiaryDetail> {
  const { data, error } = await supabase
    .from('construction_diary_entries')
    .insert({
      ...input,
      worker_names: input.worker_names.trim(),
      equipment: input.equipment.trim(),
      work_description: input.work_description.trim(),
      weather: input.weather.trim(),
      created_by: createdBy,
    })
    .select('*, job_orders(name)')
    .single()

  if (error) throw new Error(error.message)

  const entry = mapDiaryRow(data as DiaryRow)
  await attachDiaryPhotos(entry.id, entry.order_id, photos, createdBy)

  const detail = await fetchDiaryDetail(entry.id)
  if (!detail) throw new Error('Zápis se nepodařilo načíst')
  return detail
}

export async function updateDiaryEntry(
  id: string,
  input: ConstructionDiaryCreateInput,
  uploadedBy: string,
  photos: PendingDiaryPhoto[] = []
): Promise<ConstructionDiaryDetail> {
  const { data, error } = await supabase
    .from('construction_diary_entries')
    .update({
      entry_date: input.entry_date,
      order_id: input.order_id,
      weather: input.weather.trim(),
      worker_count: input.worker_count,
      worker_names: input.worker_names.trim(),
      equipment: input.equipment.trim(),
      work_description: input.work_description.trim(),
    })
    .eq('id', id)
    .select('*, job_orders(name)')
    .single()

  if (error) throw new Error(error.message)

  const entry = mapDiaryRow(data as DiaryRow)
  await attachDiaryPhotos(entry.id, entry.order_id, photos, uploadedBy)

  const detail = await fetchDiaryDetail(entry.id)
  if (!detail) throw new Error('Zápis se nepodařilo načíst')
  return detail
}

async function attachDiaryPhotos(
  diaryEntryId: string,
  orderId: string,
  photos: PendingDiaryPhoto[],
  uploadedBy: string
): Promise<void> {
  for (const photo of photos) {
    await createGpsPhoto(
      {
        file: photo.file,
        captured_at: photo.captured_at,
        gps_lat: photo.gps_lat,
        gps_lng: photo.gps_lng,
        gps_accuracy: photo.gps_accuracy,
        address_full: photo.address_full,
        street: photo.street,
        city: photo.city,
        postal_code: photo.postal_code,
        country: photo.country,
        order_id: orderId,
        diary_entry_id: diaryEntryId,
      },
      uploadedBy
    )
  }
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  const photos = await fetchDiaryPhotos(id)
  if (photos.length > 0) {
    await supabase.storage.from('gps-photos').remove(photos.map((p) => p.file_path))
  }

  const { error } = await supabase.from('construction_diary_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

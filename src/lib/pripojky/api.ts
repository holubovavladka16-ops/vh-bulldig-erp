import { supabase } from '@/lib/supabase'
import { createGpsPhoto } from '@/lib/photos/api'
import { createDiaryEntry, deleteDiaryEntry, updateDiaryEntry } from '@/lib/diary/api'
import type { ConstructionDiaryCreateInput } from '@/types/diary'
import type {
  ConnectionGpsPhoto,
  PendingConnectionPhoto,
  UtilityConnection,
  UtilityConnectionCreateInput,
  UtilityConnectionDetail,
  UtilityConnectionFilters,
} from '@/types/pripojky'

type ConnectionRow = UtilityConnection & {
  job_orders: { name: string } | null
  workers: { first_name: string; last_name: string } | null
}

function mapConnectionRow(row: ConnectionRow): UtilityConnection {
  return {
    id: row.id,
    connection_date: row.connection_date,
    worker_id: row.worker_id,
    worker_name: row.workers ? `${row.workers.last_name} ${row.workers.first_name}` : row.worker_name,
    order_id: row.order_id,
    order_name: row.job_orders?.name ?? row.order_name,
    connection_address: row.connection_address,
    work_description: row.work_description,
    length_meters: Number(row.length_meters),
    penetration_count: Number(row.penetration_count),
    work_type: row.work_type,
    diary_entry_id: row.diary_entry_id,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function buildDiaryDescription(connection: UtilityConnection): string {
  return [
    `Přípojka – ${connection.connection_address}`,
    connection.work_description,
    `Délka přípojky: ${connection.length_meters} m`,
    `Počet průrazů: ${connection.penetration_count}`,
  ].join('\n')
}

function buildDiaryInput(connection: UtilityConnection, workerName: string): ConstructionDiaryCreateInput {
  return {
    entry_date: connection.connection_date,
    order_id: connection.order_id,
    weather: 'Neuvedeno',
    worker_count: 1,
    worker_names: workerName,
    equipment: `Přípojka – ${connection.length_meters} m, ${connection.penetration_count} průrazů`,
    work_description: buildDiaryDescription(connection),
  }
}

async function linkPhotosToDiary(connectionId: string, diaryEntryId: string): Promise<void> {
  const { error } = await supabase
    .from('gps_photos')
    .update({ diary_entry_id: diaryEntryId })
    .eq('utility_connection_id', connectionId)

  if (error) throw new Error(error.message)
}

async function syncToDiary(connection: UtilityConnection, createdBy: string): Promise<string | null> {
  if (connection.work_type !== 'pripojka') {
    if (connection.diary_entry_id) {
      await deleteDiaryEntry(connection.diary_entry_id)
      await supabase.from('utility_connections').update({ diary_entry_id: null }).eq('id', connection.id)
    }
    return null
  }

  const workerName = connection.worker_name ?? 'Neznámý zaměstnanec'
  const diaryInput = buildDiaryInput(connection, workerName)

  if (connection.diary_entry_id) {
    await updateDiaryEntry(connection.diary_entry_id, diaryInput, createdBy)
    await linkPhotosToDiary(connection.id, connection.diary_entry_id)
    return connection.diary_entry_id
  }

  const diary = await createDiaryEntry(diaryInput, createdBy)
  await supabase.from('utility_connections').update({ diary_entry_id: diary.id }).eq('id', connection.id)
  await linkPhotosToDiary(connection.id, diary.id)
  return diary.id
}

async function fetchConnectionPhotos(connectionId: string): Promise<ConnectionGpsPhoto[]> {
  const { data, error } = await supabase
    .from('gps_photos')
    .select('*')
    .eq('utility_connection_id', connectionId)
    .order('captured_at', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as ConnectionGpsPhoto[]).map((row) => ({
    ...row,
    gps_lat: Number(row.gps_lat),
    gps_lng: Number(row.gps_lng),
    gps_accuracy: row.gps_accuracy != null ? Number(row.gps_accuracy) : null,
    photo_phase: row.photo_phase,
  }))
}

async function attachConnectionPhotos(
  connectionId: string,
  orderId: string,
  workerId: string,
  photos: PendingConnectionPhoto[],
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
        worker_id: workerId,
        utility_connection_id: connectionId,
        photo_phase: photo.phase,
      },
      uploadedBy
    )
  }
}

export async function fetchUtilityConnections(filters: UtilityConnectionFilters = {}): Promise<UtilityConnection[]> {
  let query = supabase
    .from('utility_connections')
    .select('*, job_orders(name), workers(first_name, last_name)')
    .order('connection_date', { ascending: false })

  if (filters.orderId) query = query.eq('order_id', filters.orderId)
  if (filters.dateFrom) query = query.gte('connection_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('connection_date', filters.dateTo)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as ConnectionRow[]).map(mapConnectionRow)
}

export async function fetchUtilityConnectionDetail(id: string): Promise<UtilityConnectionDetail | null> {
  const { data, error } = await supabase
    .from('utility_connections')
    .select('*, job_orders(name), workers(first_name, last_name)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const connection = mapConnectionRow(data as ConnectionRow)
  const photos = await fetchConnectionPhotos(id)
  return { ...connection, photos }
}

export async function createUtilityConnection(
  input: UtilityConnectionCreateInput,
  photos: PendingConnectionPhoto[],
  createdBy: string
): Promise<UtilityConnectionDetail> {
  const { data, error } = await supabase
    .from('utility_connections')
    .insert({
      ...input,
      connection_address: input.connection_address.trim(),
      work_description: input.work_description.trim(),
      created_by: createdBy,
    })
    .select('*, job_orders(name), workers(first_name, last_name)')
    .single()

  if (error) throw new Error(error.message)

  let connection = mapConnectionRow(data as ConnectionRow)
  await attachConnectionPhotos(connection.id, connection.order_id, connection.worker_id, photos, createdBy)

  connection = (await fetchUtilityConnectionDetail(connection.id))!
  await syncToDiary(connection, createdBy)

  const detail = await fetchUtilityConnectionDetail(connection.id)
  if (!detail) throw new Error('Přípojku se nepodařilo načíst')
  return detail
}

export async function updateUtilityConnection(
  id: string,
  input: UtilityConnectionCreateInput,
  photos: PendingConnectionPhoto[],
  updatedBy: string
): Promise<UtilityConnectionDetail> {
  const { data, error } = await supabase
    .from('utility_connections')
    .update({
      connection_date: input.connection_date,
      worker_id: input.worker_id,
      order_id: input.order_id,
      connection_address: input.connection_address.trim(),
      work_description: input.work_description.trim(),
      length_meters: input.length_meters,
      penetration_count: input.penetration_count,
      work_type: input.work_type,
    })
    .eq('id', id)
    .select('*, job_orders(name), workers(first_name, last_name)')
    .single()

  if (error) throw new Error(error.message)

  let connection = mapConnectionRow(data as ConnectionRow)
  await attachConnectionPhotos(connection.id, connection.order_id, connection.worker_id, photos, updatedBy)

  connection = (await fetchUtilityConnectionDetail(connection.id))!
  await syncToDiary(connection, updatedBy)

  const detail = await fetchUtilityConnectionDetail(connection.id)
  if (!detail) throw new Error('Přípojku se nepodařilo načíst')
  return detail
}

export async function deleteUtilityConnection(id: string): Promise<void> {
  const detail = await fetchUtilityConnectionDetail(id)
  if (!detail) return

  if (detail.diary_entry_id) {
    await deleteDiaryEntry(detail.diary_entry_id)
  }

  const { error } = await supabase.from('utility_connections').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

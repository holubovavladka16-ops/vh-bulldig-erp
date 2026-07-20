import {
  createGpsPhoto,
  deleteGpsPhoto,
  fetchGpsPhotos,
  getGpsPhotoUrl,
  updateGpsPhoto,
} from '@/lib/photos/api'
import { supabase } from '@/lib/supabase'
import { createThumbnail } from '@/lib/fotodokumentace-gps/geolocation'
import {
  createOfflineRecord,
  listOfflinePhotos,
  removeOfflinePhoto,
  saveOfflinePhoto,
} from '@/lib/fotodokumentace-gps/offline'
import type { GpsPhoto, GpsPhotoCreateInput } from '@/types/photos'
import type { FdgFilters, FdgSavePayload } from '@/types/fotodokumentaceGps'

export { getGpsPhotoUrl }

export function getFdgPhotoUrl(photo: Pick<GpsPhoto, 'file_path' | 'thumbnail_path'>): string {
  return getGpsPhotoUrl(photo.thumbnail_path ?? photo.file_path)
}

export async function fetchModulePhotos(filters: FdgFilters = {}): Promise<GpsPhoto[]> {
  return fetchGpsPhotos({
    orderId: filters.orderId,
    workerId: filters.workerId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    hasGps:
      filters.gpsFilter === 'with_gps' ? true : filters.gpsFilter === 'without_gps' ? false : undefined,
  })
}

async function uploadThumbnail(file: File, capturedAt: Date): Promise<string | null> {
  try {
    const thumbBlob = await createThumbnail(file)
    const path = `${capturedAt.getFullYear()}/thumb_${Date.now()}.jpg`
    const { error } = await supabase.storage.from('gps-photos').upload(path, thumbBlob, {
      contentType: 'image/jpeg',
    })
    if (error) return null
    return path
  } catch {
    return null
  }
}

export async function saveModulePhoto(
  file: File,
  payload: FdgSavePayload,
  userId: string
): Promise<GpsPhoto | { offline: true; id: string }> {
  const capturedAt = new Date(payload.captured_at)
  const thumbnailPath = await uploadThumbnail(file, capturedAt)

  const input: GpsPhotoCreateInput = {
    file,
    captured_at: capturedAt,
    gps_lat: payload.gps_lat,
    gps_lng: payload.gps_lng,
    gps_accuracy: payload.gps_accuracy,
    gps_verified: payload.gps_verified,
    sync_status: navigator.onLine ? 'synced' : 'offline',
    address_full: payload.address_full,
    street: payload.street,
    city: payload.city,
    postal_code: payload.postal_code,
    district: payload.district,
    region: payload.region,
    country: payload.country,
    note: payload.note,
    order_id: payload.order_id,
    worker_id: payload.worker_id,
    thumbnail_path: thumbnailPath,
  }

  if (!navigator.onLine) {
    const thumbBlob = thumbnailPath ? null : await createThumbnail(file).catch(() => null)
    const record = createOfflineRecord(file, payload, thumbBlob)
    await saveOfflinePhoto(record)
    return { offline: true, id: record.id }
  }

  try {
    return await createGpsPhoto(input, userId)
  } catch (err) {
    if (!navigator.onLine) {
      const record = createOfflineRecord(file, payload, null)
      await saveOfflinePhoto(record)
      return { offline: true, id: record.id }
    }
    throw err
  }
}

export async function syncOfflinePhotos(userId: string): Promise<number> {
  if (!navigator.onLine) return 0

  const pending = await listOfflinePhotos()
  let synced = 0

  for (const record of pending) {
    if (record.syncStatus === 'uploading') continue
    try {
      record.syncStatus = 'uploading'
      await saveOfflinePhoto(record)

      const file = new File([record.fileBlob], `offline_${record.id}.jpg`, {
        type: record.fileBlob.type || 'image/jpeg',
      })
      const capturedAt = new Date(record.payload.captured_at)
      const thumbnailPath = record.thumbnailBlob
        ? await (async () => {
            const path = `${capturedAt.getFullYear()}/thumb_${Date.now()}.jpg`
            const { error } = await supabase.storage.from('gps-photos').upload(path, record.thumbnailBlob!, {
              contentType: 'image/jpeg',
            })
            return error ? null : path
          })()
        : await uploadThumbnail(file, capturedAt)

      await createGpsPhoto(
        {
          file,
          captured_at: capturedAt,
          gps_lat: record.payload.gps_lat,
          gps_lng: record.payload.gps_lng,
          gps_accuracy: record.payload.gps_accuracy,
          gps_verified: record.payload.gps_verified,
          sync_status: 'synced',
          address_full: record.payload.address_full,
          street: record.payload.street,
          city: record.payload.city,
          postal_code: record.payload.postal_code,
          district: record.payload.district,
          region: record.payload.region,
          country: record.payload.country,
          note: record.payload.note,
          order_id: record.payload.order_id,
          worker_id: record.payload.worker_id,
          thumbnail_path: thumbnailPath,
        },
        userId
      )

      await removeOfflinePhoto(record.id)
      synced++
    } catch {
      record.syncStatus = 'error'
      await saveOfflinePhoto(record)
    }
  }

  return synced
}

export async function updateModulePhotoNote(id: string, note: string, userId: string): Promise<void> {
  await updateGpsPhoto(id, { note: note.trim() || null }, userId)
}

export async function removeModulePhoto(photo: GpsPhoto, userId: string): Promise<void> {
  await deleteGpsPhoto(photo.id, photo.file_path, userId)
}

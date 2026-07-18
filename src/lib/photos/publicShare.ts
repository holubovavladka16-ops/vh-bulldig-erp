import { supabase } from '@/lib/supabase'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import type { GpsPhoto } from '@/types/photos'

export interface PublicGpsPhoto {
  id: string
  file_path: string
  file_name: string
  captured_date: string
  captured_time: string
  gps_lat: number
  gps_lng: number
  gps_accuracy: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
  note: string | null
  order_name: string | null
}

export async function fetchPublicGpsPhoto(photoId: string): Promise<PublicGpsPhoto | null> {
  const { data, error } = await supabase.rpc('get_public_gps_photo', { p_photo_id: photoId })
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object') return null

  const row = data as Record<string, unknown>
  if (!row.id || !row.file_path) return null

  return {
    id: String(row.id),
    file_path: String(row.file_path),
    file_name: String(row.file_name ?? ''),
    captured_date: String(row.captured_date ?? ''),
    captured_time: String(row.captured_time ?? ''),
    gps_lat: Number(row.gps_lat),
    gps_lng: Number(row.gps_lng),
    gps_accuracy: row.gps_accuracy != null ? Number(row.gps_accuracy) : null,
    address_full: String(row.address_full ?? ''),
    street: String(row.street ?? ''),
    city: String(row.city ?? ''),
    postal_code: String(row.postal_code ?? ''),
    country: String(row.country ?? ''),
    note: row.note != null ? String(row.note) : null,
    order_name: row.order_name != null ? String(row.order_name) : null,
  }
}

export function getPublicGpsPhotoImageUrl(filePath: string): string {
  return getGpsPhotoUrl(filePath)
}

export function publicGpsPhotoToGpsPhoto(photo: PublicGpsPhoto): GpsPhoto {
  const capturedAt = `${photo.captured_date}T${photo.captured_time || '00:00:00'}`
  return {
    id: photo.id,
    file_path: photo.file_path,
    file_name: photo.file_name,
    captured_at: capturedAt,
    captured_date: photo.captured_date,
    captured_time: photo.captured_time,
    gps_lat: photo.gps_lat,
    gps_lng: photo.gps_lng,
    gps_accuracy: photo.gps_accuracy,
    device_heading: null,
    address_full: photo.address_full,
    street: photo.street,
    city: photo.city,
    postal_code: photo.postal_code,
    country: photo.country,
    note: photo.note,
    order_id: null,
    worker_id: null,
    report_id: null,
    diary_entry_id: null,
    utility_connection_id: null,
    photo_phase: null,
    construction_point_id: null,
    sort_order: 0,
    order_name: photo.order_name ?? undefined,
    created_by: null,
    created_at: capturedAt,
    updated_at: capturedAt,
  }
}

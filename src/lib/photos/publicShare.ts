import { supabase } from '@/lib/supabase'
import { getGpsPhotoUrl } from '@/lib/photos/api'

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

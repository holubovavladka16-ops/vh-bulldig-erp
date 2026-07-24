import type { GpsPhoto, GpsPhotoFilters } from '@/types/photos'

export interface GpsFotoarchivFilters extends GpsPhotoFilters {
  search?: string
}

export interface GpsFotoarchivSaveInput {
  file: File
  gps_lat: number
  gps_lng: number
  gps_accuracy: number | null
  device_heading?: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
  captured_at: Date
  order_id: string
  report_id?: string | null
  device_info: string
}

export interface GpsFotoarchivEditInput {
  title?: string | null
  note?: string | null
  order_id?: string | null
  report_id?: string | null
  diary_entry_id?: string | null
}

export type GpsFotoarchivPhoto = GpsPhoto

export interface AuthorOption {
  value: string
  label: string
}

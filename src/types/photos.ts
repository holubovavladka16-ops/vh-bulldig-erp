export interface GpsPhoto {
  id: string
  file_path: string
  file_name: string
  captured_at: string
  captured_date: string
  captured_time: string
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  device_heading: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
  note: string | null
  order_id: string | null
  worker_id: string | null
  report_id: string | null
  diary_entry_id: string | null
  utility_connection_id: string | null
  photo_phase: 'pred' | 'po' | null
  construction_point_id: string | null
  sort_order: number
  order_name?: string
  worker_name?: string
  creator_name?: string
  created_by: string | null
  created_at: string
  updated_at: string
  gps_verified?: boolean
  sync_status?: string | null
  district?: string
  region?: string
  uploaded_at?: string | null
  thumbnail_path?: string | null
}

export interface GpsPhotoHistoryEntry {
  id: string
  photo_id: string
  action: string
  details: Record<string, unknown> | null
  performed_by: string | null
  created_at: string
}

export interface GpsPhotoCreateInput {
  file: File
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  gps_verified?: boolean
  sync_status?: string | null
  district?: string
  region?: string
  thumbnail_path?: string | null
  device_heading?: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
  captured_at: Date
  note?: string
  order_id?: string | null
  worker_id?: string | null
  report_id?: string | null
  diary_entry_id?: string | null
  utility_connection_id?: string | null
  photo_phase?: 'pred' | 'po' | null
  construction_point_id?: string | null
}

export interface GpsPhotoFilters {
  orderId?: string
  workerId?: string
  dateFrom?: string
  dateTo?: string
  hasGps?: boolean
}

export interface GeocodedAddress {
  address_full: string
  street: string
  city: string
  postal_code: string
  district?: string
  region?: string
  country: string
}

export interface GpsPhotoDetail extends GpsPhoto {
  history: GpsPhotoHistoryEntry[]
}

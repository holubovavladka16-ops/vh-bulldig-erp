export interface GpsPhoto {
  id: string
  file_path: string
  file_name: string
  captured_at: string
  captured_date: string
  captured_time: string
  gps_lat: number
  gps_lng: number
  gps_accuracy: number | null
  device_heading: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
  note: string | null
  title: string | null
  device_info: string | null
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
  note?: string
  title?: string | null
  device_info?: string | null
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
  createdBy?: string
  dateFrom?: string
  dateTo?: string
}

export interface GeocodedAddress {
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
}

export interface GpsPhotoDetail extends GpsPhoto {
  history: GpsPhotoHistoryEntry[]
}

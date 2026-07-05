import type { GpsPhoto } from '@/types/photos'

export interface ConstructionDiaryEntry {
  id: string
  entry_date: string
  order_id: string
  order_name?: string
  weather: string
  worker_count: number
  worker_names: string
  equipment: string
  work_description: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ConstructionDiaryCreateInput {
  entry_date: string
  order_id: string
  weather: string
  worker_count: number
  worker_names: string
  equipment: string
  work_description: string
}

export interface ConstructionDiaryFilters {
  orderId?: string
  dateFrom?: string
  dateTo?: string
}

export interface PendingDiaryPhoto {
  file: File
  captured_at: Date
  gps_lat: number
  gps_lng: number
  gps_accuracy: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
}

export interface ConstructionDiaryDetail extends ConstructionDiaryEntry {
  photos: GpsPhoto[]
}

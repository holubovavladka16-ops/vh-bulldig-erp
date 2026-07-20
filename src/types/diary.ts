import type { DiaryWeatherType } from '@/constants/diary'
import type { GpsPhoto } from '@/types/photos'

export interface ConstructionDiaryEntry {
  id: string
  entry_number: number | null
  entry_date: string
  order_id: string
  order_name?: string
  order_number?: string | null
  weather: string
  weather_type: DiaryWeatherType | null
  temperature_celsius: number | null
  site_location: string
  worker_count: number
  worker_names: string
  equipment: string
  material: string
  performances_summary: string
  rough_work_description: string
  work_description: string
  ai_work_description: string
  ai_assisted: boolean
  note: string
  extraordinary_events: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ConstructionDiaryCreateInput {
  entry_date: string
  order_id: string
  weather: string
  weather_type: DiaryWeatherType | null
  temperature_celsius: number | null
  site_location: string
  worker_count: number
  worker_names: string
  equipment: string
  material: string
  performances_summary: string
  rough_work_description: string
  work_description: string
  ai_work_description: string
  ai_assisted: boolean
  note: string
  extraordinary_events: string
  /** ID propojených fotografií k zápisu ve stavebním deníku */
  linked_photo_ids?: string[]
}

export interface ConstructionDiaryFilters {
  orderId?: string
  dateFrom?: string
  dateTo?: string
}

export type DiaryExportScope = 'all' | 'period' | 'order'

export interface DiaryExportOptions {
  scope: DiaryExportScope
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

export interface DiaryPrefillWorker {
  id: string
  first_name: string
  last_name: string
  full_name: string
}

export interface DiaryPrefillData {
  order_name: string
  site_location: string
  workers: DiaryPrefillWorker[]
  worker_count: number
  worker_names: string
  performances_summary: string
  material_hints: string[]
  photos: GpsPhoto[]
}

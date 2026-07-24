import type { GpsPhoto } from '@/types/photos'

export type UtilityConnectionWorkType = 'pripojka' | 'jina'
export type ConnectionPhotoPhase = 'pred' | 'po'

export interface UtilityConnection {
  id: string
  connection_date: string
  worker_id: string
  worker_name?: string
  order_id: string
  order_name?: string
  connection_address: string
  work_description: string
  length_meters: number
  penetration_count: number
  work_type: UtilityConnectionWorkType
  diary_entry_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface UtilityConnectionCreateInput {
  connection_date: string
  worker_id: string
  order_id: string
  connection_address: string
  work_description: string
  length_meters: number
  penetration_count: number
  work_type: UtilityConnectionWorkType
}

export interface UtilityConnectionFilters {
  orderId?: string
  dateFrom?: string
  dateTo?: string
}

export interface PendingConnectionPhoto {
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
  phase: ConnectionPhotoPhase
}

export interface ConnectionGpsPhoto extends GpsPhoto {
  photo_phase: ConnectionPhotoPhase | null
}

export interface UtilityConnectionDetail extends UtilityConnection {
  photos: ConnectionGpsPhoto[]
}

export const WORK_TYPE_OPTIONS = [
  { value: 'pripojka', label: 'Přípojka' },
  { value: 'jina', label: 'Jiná práce' },
] as const

export const PHOTO_PHASE_LABELS: Record<ConnectionPhotoPhase, string> = {
  pred: 'Před zahájením práce',
  po: 'Po dokončení práce',
}

export const MAX_PHOTOS_PER_PHASE = 2

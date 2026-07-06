import type { GpsPhoto, GpsPhotoHistoryEntry } from '@/types/photos'

export interface ConstructionPoint {
  id: string
  point_number: number
  name: string
  order_id: string | null
  gps_lat: number
  gps_lng: number
  gps_accuracy: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  country: string
  created_by: string | null
  created_at: string
  updated_at: string
  order_name?: string
  creator_name?: string
  photo_count?: number
}

export interface ConstructionPointNote {
  id: string
  point_id: string
  content: string
  created_by: string | null
  created_at: string
  updated_at: string
  author_name?: string
}

export interface ConstructionPointHistoryEntry {
  id: string
  point_id: string
  action: string
  details: Record<string, unknown> | null
  performed_by: string | null
  created_at: string
  performer_name?: string
}

export interface ConstructionPointDetail extends ConstructionPoint {
  photos: GpsPhoto[]
  notes: ConstructionPointNote[]
  history: ConstructionPointHistoryEntry[]
  photo_history: GpsPhotoHistoryEntry[]
}

export interface ConstructionPointFilters {
  orderId?: string
  workerId?: string
  dateFrom?: string
  dateTo?: string
}

export interface ConstructionPointUpdateInput {
  name?: string
  order_id?: string | null
  gps_lat?: number
  gps_lng?: number
  gps_accuracy?: number | null
  address_full?: string
  street?: string
  city?: string
  postal_code?: string
  country?: string
}

export function formatPointLabel(point: Pick<ConstructionPoint, 'point_number' | 'name'>): string {
  const base = point.name.trim() || `Stavební bod ${point.point_number}`
  return base
}

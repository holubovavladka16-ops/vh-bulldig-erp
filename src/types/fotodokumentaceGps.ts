import type { GpsPhoto } from '@/types/photos'

export type FdgSyncStatus = 'offline' | 'pending' | 'uploading' | 'synced' | 'error'

export interface FotodokumentaceGpsPhoto extends GpsPhoto {
  gps_verified?: boolean
  sync_status?: FdgSyncStatus | null
  district?: string
  region?: string
  uploaded_at?: string | null
  thumbnail_path?: string | null
}

export interface FdgFilters {
  orderId?: string
  workerId?: string
  dateFrom?: string
  dateTo?: string
  gpsFilter?: 'all' | 'with_gps' | 'without_gps'
}

export interface FdgPendingCapture {
  file: File
  previewUrl: string
  capturedAt: Date
  exifLat?: number | null
  exifLng?: number | null
}

export interface FdgLocationDraft {
  lat: number | null
  lng: number | null
  accuracy: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  district: string
  region: string
  country: string
  gpsVerified: boolean
  loading: boolean
  error: string | null
}

export interface FdgOfflineRecord {
  id: string
  payload: FdgSavePayload
  fileBlob: Blob
  thumbnailBlob: Blob | null
  createdAt: string
  syncStatus: FdgSyncStatus
}

export interface FdgSavePayload {
  order_id: string
  worker_id: string | null
  note: string
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  gps_verified: boolean
  address_full: string
  street: string
  city: string
  postal_code: string
  district: string
  region: string
  country: string
  captured_at: string
}

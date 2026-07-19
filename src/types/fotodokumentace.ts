export type FotoGpsStatus = 'verified' | 'unverified' | 'manual' | 'missing'

export type FotoApprovalStatus =
  | 'nova'
  | 'ke_kontrole'
  | 'schvalena'
  | 'zamitnuta'
  | 'archivovana'

export type FotoSyncStatus =
  | 'offline'
  | 'pending'
  | 'uploading'
  | 'synced'
  | 'error'

export interface FotoDokument {
  id: string
  file_path: string
  file_name: string
  thumbnail_path: string | null
  original_file_path: string | null
  watermarked_file_path: string | null
  captured_at: string
  captured_date: string
  captured_time: string
  uploaded_at: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  gps_status: FotoGpsStatus
  device_heading: number | null
  address_full: string
  street: string
  city: string
  postal_code: string
  district: string
  region: string
  country: string
  map_url: string | null
  note: string | null
  photo_type: string | null
  order_id: string | null
  worker_id: string | null
  report_id: string | null
  diary_entry_id: string | null
  utility_connection_id: string | null
  series_id: string | null
  paired_photo_id: string | null
  approval_status: FotoApprovalStatus
  sync_status: FotoSyncStatus | null
  sort_order: number
  order_name?: string
  worker_name?: string
  creator_name?: string
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface FotoAuditEntry {
  id: string
  photo_id: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  reason: string | null
  performed_by: string | null
  performer_name?: string
  created_at: string
}

export interface FotoSerie {
  id: string
  name: string
  order_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FotoTyp {
  id: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
}

export interface FotoAdresa {
  address_full: string
  street: string
  city: string
  postal_code: string
  district: string
  region: string
  country: string
}

export interface FotoPoloha {
  lat: number
  lng: number
  accuracy: number
  capturedAt: Date
}

export interface FotoUlozitVstup {
  file: File
  thumbnail?: File
  watermarked?: File
  captured_at: Date
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  gps_status: FotoGpsStatus
  device_heading?: number | null
  address: FotoAdresa
  map_url?: string | null
  note?: string
  photo_type?: string | null
  order_id: string
  worker_id?: string | null
  report_id?: string | null
  diary_entry_id?: string | null
  utility_connection_id?: string | null
  series_id?: string | null
}

export interface FotoFiltry {
  orderId?: string
  workerId?: string
  photoType?: string
  dateFrom?: string
  dateTo?: string
  dateExact?: string
  addressQuery?: string
  cityQuery?: string
  hasGps?: boolean
  noGps?: boolean
  approvalStatus?: FotoApprovalStatus
  includeDeleted?: boolean
  seriesId?: string
}

export interface FotoOfflineZaznam {
  localId: string
  payload: FotoUlozitVstup
  createdBy: string
  status: FotoSyncStatus
  errorMessage?: string
  createdAt: string
}

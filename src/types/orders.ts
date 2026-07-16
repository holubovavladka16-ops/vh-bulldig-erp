export type JobOrderStatus =
  | 'pripravuje_se'
  | 'aktivni'
  | 'pozastavena'
  | 'dokoncena'
  | 'archivovana'

export interface JobOrder {
  id: string
  name: string
  location: string
  work_description: string
  start_date: string
  end_date: string
  order_number: string | null
  short_code: string | null
  investor: string | null
  client_name: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  note: string | null
  status: JobOrderStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface JobOrderDocument {
  id: string
  order_id: string
  title: string
  file_path: string
  file_name: string
  uploaded_by: string | null
  created_at: string
}

export interface JobOrderPhoto {
  id: string
  order_id: string
  file_path: string
  file_name: string
  uploaded_by: string | null
  created_at: string
}

export interface JobOrderCreateInput {
  name: string
  location: string
  work_description: string
  start_date: string
  end_date: string
  order_number?: string
  short_code?: string
  investor?: string
  client_name?: string
  contact_person?: string
  phone?: string
  email?: string
  gps_lat?: number | null
  gps_lng?: number | null
  gps_accuracy?: number | null
  note?: string
  status?: JobOrderStatus
}

export interface JobOrderFilters {
  search?: string
  location?: string
  status?: JobOrderStatus | ''
  dateFrom?: string
  dateTo?: string
}

export interface JobOrderEmployeeSummary {
  id: string
  first_name: string
  last_name: string
  position: string
}

export interface JobOrderAdvanceSummary {
  form_date: string
  worker_id: string
  worker_name: string
  advance: number
  earnings: number
}

export interface JobOrderDetail {
  order: JobOrder
  documents: JobOrderDocument[]
  photos: JobOrderPhoto[]
  employees: JobOrderEmployeeSummary[]
  attendance: import('@/types/workers').WorkerAttendanceRecord[]
  reports: import('@/types/workers').WorkerReport[]
  advances: JobOrderAdvanceSummary[]
}

export interface ActiveJobOrderOption {
  id: string
  name: string
  location: string
}

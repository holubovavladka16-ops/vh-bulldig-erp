export type EmploymentType = 'HPP' | 'DPP' | 'DPC' | 'ICO'
export type WorkerStatus = 'aktivni' | 'neaktivni' | 'archiv'
export type WorkerDocumentCategory =
  | 'pracovni_smlouva'
  | 'dodatek'
  | 'obcansky_prukaz'
  | 'ridicsky_prukaz'
  | 'lekarska_prohlidka'
  | 'bozp'
  | 'certifikat'
  | 'ostatni'
export type WorkerFormStatus = 'koncept' | 'odeslany' | 'schvaleny' | 'k_oprave'
export type WorkerReportStatus = 'cekajici' | 'schvaleny' | 'k_oprave'
export type PriceUnitType = 'hodina' | 'metr' | 'kus' | 'pausal' | 'm2' | 'den'
export type WorkType = 'hodinova' | 'ukolova' | 'kombinovana'

export type AttendanceStatus = 'pritomen' | 'dovolena' | 'nemoc' | 'ocr' | 'neplacene_volno'

export interface Worker {
  id: string
  first_name: string
  last_name: string
  address: string
  birth_date: string
  start_date: string
  employment_type: EmploymentType
  position: string
  assigned_order: string
  assigned_order_id: string | null
  phone: string | null
  email: string | null
  birth_number: string | null
  nationality: string | null
  note: string | null
  photo_url: string | null
  status: WorkerStatus
  portal_token: string
  end_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkerPriceItem {
  id: string
  worker_id: string
  name: string
  unit_type: PriceUnitType
  price: number
  is_default: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface WorkerDocument {
  id: string
  worker_id: string
  category: WorkerDocumentCategory
  title: string
  file_path: string
  file_name: string
  uploaded_by: string | null
  created_at: string
}

export interface WorkerDailyForm {
  id: string
  worker_id: string
  form_date: string
  order_id: string | null
  order_name: string
  activity: string
  work_type: WorkType
  work_description: string
  work_start: string | null
  work_end: string | null
  break_minutes: number
  price_item_id: string | null
  hours: number
  meters: number
  pieces: number
  advance: number
  material: string
  note: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  signature_data: string | null
  earnings: number
  status: WorkerFormStatus
  submitted_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkerFormTaskItem {
  id: string
  price_item_id: string
  quantity: number
  line_earnings: number
  sort_order: number
  item_name?: string
  unit_type?: PriceUnitType
}

export interface TaskLineInput {
  price_item_id: string
  quantity: number
  /** Stabilní klíč pro React – nepřenáší se do API. */
  lineKey?: string
}

export interface WorkerFormPhoto {
  id: string
  form_id: string
  file_path: string
  file_name: string
  created_at: string
}

export interface WorkerReport {
  id: string
  worker_id: string
  form_id: string | null
  report_date: string
  order_id: string | null
  order_name: string
  activity: string
  hours: number
  meters: number
  pieces: number
  earnings: number
  material: string
  advance: number
  note: string | null
  status: WorkerReportStatus
  created_at: string
}

export interface WorkerAttendanceRecord {
  id: string
  worker_id: string
  form_id: string | null
  attendance_date: string
  order_id: string | null
  order_name: string
  hours: number
  daily_advance?: number
  work_start: string | null
  work_end: string | null
  break_minutes: number
  attendance_status: AttendanceStatus
  note: string
  created_at: string
}

export interface AttendanceUpsertInput {
  worker_id: string
  attendance_date: string
  order_id: string | null
  work_start: string
  work_end: string
  break_minutes: number
  daily_advance: number
  note: string
  task_items: TaskLineInput[]
}

export interface WorkerHistoryEntry {
  id: string
  worker_id: string
  action: string
  details: Record<string, unknown>
  performed_by: string | null
  created_at: string
}

export interface WorkerStatistics {
  id: string
  worker_id: string
  stat_date: string
  earnings: number
  hours: number
  meters: number
  orders_count: number
  advances: number
  created_at: string
}

export interface WorkerEarningsSummary {
  today_earnings: number
  month_earnings: number
  month_hours: number
  month_meters: number
  month_orders: number
  month_advances: number
}

export interface WorkerCreateInput {
  first_name: string
  last_name: string
  address: string
  birth_date: string
  start_date: string
  employment_type: EmploymentType
  position: string
  assigned_order?: string
  assigned_order_id?: string | null
  phone?: string
  email?: string
  birth_number?: string
  nationality?: string
  note?: string
  photo_url?: string
}

export interface PortalWorker {
  id: string
  first_name: string
  last_name: string
  position: string
  status: WorkerStatus
  employment_type: EmploymentType
  assigned_order: string
  assigned_order_id: string | null
}

export interface PortalDailyAdvance {
  form_date: string
  advance: number
  earnings: number
  status: WorkerFormStatus
}

export interface PortalAttendanceRecord {
  id: string
  attendance_date: string
  order_id: string | null
  order_name: string
  work_start: string | null
  work_end: string | null
  break_minutes: number
  hours: number
  attendance_status?: AttendanceStatus
  note?: string
}

export interface ReportTaskItemDetail {
  id: string
  price_item_id: string
  name: string
  unit_type: PriceUnitType
  price: number
  quantity: number
  line_earnings: number
  sort_order: number
}

export interface ReportDetail {
  report: WorkerReport
  form: WorkerDailyForm | null
  worker: { first_name: string; last_name: string; position: string }
  task_items: ReportTaskItemDetail[]
  photos: WorkerFormPhoto[]
}

export type WorkerFilter = 'aktivni' | 'neaktivni' | 'archiv' | 'vse'

export type WorkerTabId =
  | 'osobni-karta'
  | 'cenik'
  | 'dokumenty'
  | 'vykazy'
  | 'dochazka'
  | 'historie'
  | 'formular'

export type PortalTabId = 'denni-formular' | 'moje-dochazka' | 'muj-vykaz' | 'prehled-vydelku'

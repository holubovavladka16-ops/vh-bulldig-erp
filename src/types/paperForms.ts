export type PaperFormStatus =
  | 'draft'
  | 'assigned'
  | 'printed'
  | 'distributed'
  | 'returned'
  | 'scanned'
  | 'imported'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'archived'

export type PaperFormLineRole = 'attendance_primary' | 'performance' | 'performance_continuation'

export interface PaperOrderLegendItem {
  short_code: string
  name: string
  location: string
  order_id: string
}

export interface PaperWorkerSnapshot {
  first_name: string
  last_name: string
  address: string
  birth_date: string
  start_date: string
  position: string
  employment_type: string
  phone?: string | null
  birth_number?: string | null
}

export interface PaperMonthlyForm {
  id: string
  public_id: string
  form_number: string
  month: number
  year: number
  worker_id: string | null
  supervisor_id: string | null
  status: PaperFormStatus
  form_variant?: 'worker_first' | 'order_first' | null
  worker_snapshot: PaperWorkerSnapshot | null
  order_legend: PaperOrderLegendItem[]
  blank_pdf_path: string | null
  scanned_photo_path: string | null
  signed_pdf_path: string | null
  ai_confidence: number | null
  ai_model: string | null
  ai_processed_at: string | null
  summary: Record<string, unknown>
  imported_by: string | null
  imported_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  printed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PaperFormLine {
  id: string
  paper_form_id: string
  line_number: number
  source_section: string
  form_date: string
  line_role: PaperFormLineRole
  work_start: string | null
  work_end: string | null
  break_minutes: number
  attendance_status: string
  order_code: string | null
  order_id: string | null
  order_name_resolved: string | null
  price_item_id: string | null
  work_type_text: string | null
  quantity: number | null
  unit: string | null
  performance_hours: number | null
  manual_dig_bm: number | null
  penetration_ks: number | null
  overtime_hours: number | null
  daily_advance: number
  material: string
  note: string
  worker_daily_form_id: string | null
  ai_confidence: number | null
  ai_flags: Record<string, unknown>
  sort_order: number
}

export interface PaperFormListItem extends PaperMonthlyForm {
  worker_name?: string | null
}

export interface PaperFormResolved {
  id: string
  public_id: string
  form_number: string
  month: number
  year: number
  worker_id: string | null
  worker_name: string | null
  status: PaperFormStatus
  needs_worker_assignment?: boolean
}

export interface PaperFormAiLine {
  form_date: string
  line_role?: PaperFormLineRole
  source_section?: string
  work_start?: string
  work_end?: string
  break_minutes?: number
  order_code?: string
  order_name_resolved?: string
  work_type_text?: string
  quantity?: number
  unit?: string
  performance_hours?: number
  manual_dig_bm?: number
  penetration_ks?: number
  daily_advance?: number
  material?: string
  note?: string
  ai_confidence?: number
  attendance_status?: string
}

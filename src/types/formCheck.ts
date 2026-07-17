import type { PaperFormStatus } from '@/types/paperForms'

/** Fáze workflow modulu Kontrola formuláře. */
export type FormCheckPhase =
  | 'scan'
  | 'confirm'
  | 'capture'
  | 'ocr'
  | 'compare'
  | 'result'

export type FormCheckErrorCode =
  | 'invalid_qr'
  | 'form_not_found'
  | 'no_worker'
  | 'resolve_failed'
  | 'camera_error'
  | 'upload_failed'
  | 'ocr_failed'
  | 'compare_failed'
  | 'attendance_missing'
  | 'unknown'

export interface FormCheckError {
  code: FormCheckErrorCode
  message: string
}

/** Kontext načteného formuláře po úspěšném QR skenu. */
export interface FormCheckContext {
  formId: string
  publicId: string
  formNumber: string
  workerId: string | null
  workerName: string | null
  month: number
  year: number
  periodLabel: string
  status: PaperFormStatus
  needsWorkerAssignment: boolean
}

export interface FormCheckOcrLine {
  formDate: string
  orderCode: string | null
  orderName: string | null
  performanceHours: number | null
  manualDigBm: number | null
  penetrationKs: number | null
  dailyAdvance: number | null
  note: string
  confidence: number | null
}

export interface FormCheckOcrSummary {
  totalHours: number | null
  totalBm: number | null
  totalPenetrations: number | null
  totalAdvance: number | null
}

export interface FormCheckOcrResult {
  workerName: string | null
  monthLabel: string | null
  month: number
  year: number
  lines: FormCheckOcrLine[]
  summary: FormCheckOcrSummary
  overallConfidence: number | null
  aiModel: string | null
  storagePath: string | null
}

export type CompareItemStatus =
  | 'match'
  | 'mismatch'
  | 'missing_in_erp'
  | 'missing_on_form'
  | 'low_confidence'
  | 'not_compared'

export type CompareOutcome = 'match' | 'mismatch' | 'manual_review'

export type CompareFieldKey =
  | 'hours'
  | 'order'
  | 'manual_dig'
  | 'penetration'
  | 'advance'
  | 'note'

export interface CompareItem {
  date: string
  field: CompareFieldKey
  fieldLabel: string
  erpValue: string
  formValue: string
  status: CompareItemStatus
  confidence: number | null
}

export interface CompareSummaryRow {
  field: CompareFieldKey
  fieldLabel: string
  erpTotal: number | null
  formTotal: number | null
  status: CompareItemStatus
  confidence: number | null
}

export interface FormCheckComparisonResult {
  outcome: CompareOutcome
  comparedDays: number
  comparedItems: number
  differenceCount: number
  formTotalHours: number | null
  erpTotalHours: number | null
  items: CompareItem[]
  summaryRows: CompareSummaryRow[]
  needsManualReview: boolean
}

export interface ErpAttendanceDay {
  date: string
  hours: number | null
  orderCode: string | null
  orderName: string | null
  manualDigBm: number | null
  penetrationKs: number | null
  advance: number | null
  note: string | null
}

export interface FormCheckRecordListItem {
  id: string
  formId: string
  formNumber: string
  workerId: string
  workerName: string
  month: number
  year: number
  periodLabel: string
  checkedAt: string
  outcome: CompareOutcome
  differenceCount: number
  ocrConfidence: number | null
  photoPath: string | null
  checkedById: string | null
  checkedByName: string | null
}

export interface FormCheckRecordDetail extends FormCheckRecordListItem {
  ocrResult: FormCheckOcrResult
  comparisonResult: FormCheckComparisonResult
}

export interface FormCheckStats {
  totalChecks: number
  matchCount: number
  mismatchCount: number
  manualReviewCount: number
  ocrSuccessRate: number | null
  averageConfidence: number | null
}

export interface FormCheckHistoryFilters {
  workerId?: string
  month?: number
  year?: number
  outcome?: CompareOutcome | ''
  checkedBy?: string
}

/** Stav workflow – připraveno pro rozšíření o porovnání a ukládání. */
export interface FormCheckWorkflowState {
  phase: FormCheckPhase
  context: FormCheckContext | null
  error: FormCheckError | null
  /** Fáze 2: náhled pořízené fotografie formuláře (lokální blob URL) */
  capturedImagePreviewUrl: string | null
  /** Fáze 3: cesta k nahrané fotografii ve Storage */
  capturedImageStoragePath: string | null
  /** Fáze 3: výsledek OCR */
  ocrResult: FormCheckOcrResult | null
  /** Fáze 4+: výsledek porovnání s docházkou */
  comparisonResult: FormCheckComparisonResult | null
  savedRecordId: string | null
}

export const INITIAL_FORM_CHECK_STATE: FormCheckWorkflowState = {
  phase: 'scan',
  context: null,
  error: null,
  capturedImagePreviewUrl: null,
  capturedImageStoragePath: null,
  ocrResult: null,
  comparisonResult: null,
  savedRecordId: null,
}

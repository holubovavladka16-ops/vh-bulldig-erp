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
  comparisonResult: unknown | null
}

export const INITIAL_FORM_CHECK_STATE: FormCheckWorkflowState = {
  phase: 'scan',
  context: null,
  error: null,
  capturedImagePreviewUrl: null,
  capturedImageStoragePath: null,
  ocrResult: null,
  comparisonResult: null,
}

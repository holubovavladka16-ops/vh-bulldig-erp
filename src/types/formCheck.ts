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

/** Stav workflow – připraveno pro rozšíření o OCR, porovnání a ukládání. */
export interface FormCheckWorkflowState {
  phase: FormCheckPhase
  context: FormCheckContext | null
  error: FormCheckError | null
  /** Fáze 2: náhled pořízené fotografie formuláře (lokální blob URL) */
  capturedImagePreviewUrl: string | null
  /** Fáze 2+: výsledek OCR */
  ocrResult: unknown | null
  /** Fáze 3+: výsledek porovnání s docházkou */
  comparisonResult: unknown | null
}

export const INITIAL_FORM_CHECK_STATE: FormCheckWorkflowState = {
  phase: 'scan',
  context: null,
  error: null,
  capturedImagePreviewUrl: null,
  ocrResult: null,
  comparisonResult: null,
}

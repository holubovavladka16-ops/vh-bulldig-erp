import type { FormCheckContext, FormCheckError, FormCheckOcrResult, FormCheckWorkflowState, FormCheckComparisonResult } from '@/types/formCheck'
import { INITIAL_FORM_CHECK_STATE } from '@/types/formCheck'

export function createInitialFormCheckState(): FormCheckWorkflowState {
  return { ...INITIAL_FORM_CHECK_STATE }
}

export function transitionToConfirm(
  state: FormCheckWorkflowState,
  context: FormCheckContext
): FormCheckWorkflowState {
  return {
    ...state,
    phase: 'confirm',
    context,
    error: null,
  }
}

export function transitionToScan(_state: FormCheckWorkflowState): FormCheckWorkflowState {
  void _state
  return createInitialFormCheckState()
}

export function transitionToError(
  state: FormCheckWorkflowState,
  error: FormCheckError
): FormCheckWorkflowState {
  return {
    ...state,
    phase: 'scan',
    context: null,
    error,
  }
}

/** Fáze 2: přechod na focení formuláře. */
export function transitionToCapture(state: FormCheckWorkflowState): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'capture',
    capturedImagePreviewUrl: null,
    capturedImageStoragePath: null,
    ocrResult: null,
    comparisonResult: null,
    error: null,
  }
}

/** Fáze 2: uložení pořízené fotografie do workflow (bez uploadu). */
export function transitionCaptureComplete(
  state: FormCheckWorkflowState,
  previewUrl: string
): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    capturedImagePreviewUrl: previewUrl,
    error: null,
  }
}

/** Návrat z focení na potvrzovací obrazovku. */
export function transitionBackToConfirm(state: FormCheckWorkflowState): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'confirm',
    capturedImagePreviewUrl: null,
    capturedImageStoragePath: null,
    ocrResult: null,
    comparisonResult: null,
    error: null,
  }
}

/** Znovu otevřít focení (zrušit náhled / OCR). */
export function transitionRetakeCapture(state: FormCheckWorkflowState): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'capture',
    capturedImagePreviewUrl: null,
    capturedImageStoragePath: null,
    ocrResult: null,
    comparisonResult: null,
    error: null,
  }
}

/** Fáze 3: přechod na zpracování OCR. */
export function transitionToOcr(state: FormCheckWorkflowState, previewUrl: string): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'ocr',
    capturedImagePreviewUrl: previewUrl,
    capturedImageStoragePath: null,
    ocrResult: null,
    comparisonResult: null,
    error: null,
  }
}

/** Fáze 3: úspěšné dokončení OCR. */
export function transitionOcrComplete(
  state: FormCheckWorkflowState,
  ocrResult: FormCheckOcrResult,
  storagePath: string
): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'ocr',
    capturedImageStoragePath: storagePath,
    ocrResult: { ...ocrResult, storagePath },
    error: null,
  }
}

/** Fáze 3: chyba při OCR nebo uploadu. */
export function transitionOcrError(
  state: FormCheckWorkflowState,
  error: FormCheckError
): FormCheckWorkflowState {
  return {
    ...state,
    phase: 'ocr',
    error,
  }
}

/** Fáze 4: přechod na porovnání s docházkou. */
export function transitionToCompare(state: FormCheckWorkflowState): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'compare',
    error: null,
  }
}

/** Fáze 4: úspěšné dokončení porovnání. */
export function transitionCompareComplete(
  state: FormCheckWorkflowState,
  comparisonResult: FormCheckComparisonResult
): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'compare',
    comparisonResult,
    error: null,
  }
}

/** Fáze 4: chyba při porovnání. */
export function transitionCompareError(
  state: FormCheckWorkflowState,
  error: FormCheckError
): FormCheckWorkflowState {
  return {
    ...state,
    phase: 'compare',
    error,
  }
}

/** Fáze 5: potvrzení a uložení kontroly. */
export function transitionToResult(
  state: FormCheckWorkflowState,
  savedRecordId: string
): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'result',
    savedRecordId,
    error: null,
  }
}

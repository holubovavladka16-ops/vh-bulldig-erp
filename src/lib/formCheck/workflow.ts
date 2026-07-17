import type { FormCheckContext, FormCheckError, FormCheckWorkflowState } from '@/types/formCheck'
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

/** Fáze 2: přechod na focení formuláře pro OCR. */
export function transitionToCapture(state: FormCheckWorkflowState): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'capture',
    error: null,
  }
}

/** Fáze 2: přechod na zpracování OCR. */
export function transitionToOcr(state: FormCheckWorkflowState): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'ocr',
    error: null,
  }
}

/** Fáze 3: přechod na porovnání s docházkou. */
export function transitionToCompare(state: FormCheckWorkflowState): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'compare',
    error: null,
  }
}

/** Fáze 4: přechod na výsledek / uložení. */
export function transitionToResult(state: FormCheckWorkflowState): FormCheckWorkflowState {
  if (!state.context) return state
  return {
    ...state,
    phase: 'result',
    error: null,
  }
}

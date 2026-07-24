import type { CompareOutcome } from '@/types/formCheck'

export const FORM_CHECK_OUTCOME_LABELS: Record<CompareOutcome, string> = {
  match: 'SHODA',
  mismatch: 'NESHODA',
  manual_review: 'RUČNÍ KONTROLA',
}

export const FORM_CHECK_OUTCOME_DESCRIPTIONS: Record<CompareOutcome, string> = {
  match: 'Všechny přečtené údaje odpovídají docházce v ERP.',
  mismatch: 'Byly nalezeny rozdíly oproti docházce v ERP.',
  manual_review: 'Některé položky vyžadují ruční ověření (nízká OCR confidence).',
}

export const FORM_CHECK_OUTCOME_VARIANT: Record<
  CompareOutcome,
  'success' | 'danger' | 'warning'
> = {
  match: 'success',
  mismatch: 'danger',
  manual_review: 'warning',
}

export const FORM_CHECK_OUTCOME_CARD_CLASS: Record<CompareOutcome, string> = {
  match: 'border-green-500/40 bg-green-500/10',
  mismatch: 'border-red-500/40 bg-red-500/10',
  manual_review: 'border-amber-500/40 bg-amber-500/10',
}

export const FORM_CHECK_OUTCOME_TEXT_CLASS: Record<CompareOutcome, string> = {
  match: 'text-green-300',
  mismatch: 'text-red-300',
  manual_review: 'text-amber-300',
}

export const FORM_CHECK_OUTCOME_FILTER_OPTIONS: { value: CompareOutcome | ''; label: string }[] = [
  { value: '', label: 'Všechny výsledky' },
  { value: 'match', label: 'Shoda' },
  { value: 'mismatch', label: 'Neshoda' },
  { value: 'manual_review', label: 'Ruční kontrola' },
]

export const FORM_CHECK_OUTCOME_STYLES: Record<
  CompareOutcome,
  { bg: string; text: string; border: string }
> = {
  match: {
    bg: 'bg-green-500/15',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-500/40',
  },
  mismatch: {
    bg: 'bg-red-500/15',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-500/40',
  },
  manual_review: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-500/40',
  },
}

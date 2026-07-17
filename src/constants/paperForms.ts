import type { PaperFormStatus } from '@/types/paperForms'

export const PAPER_FORM_STATUS_LABELS: Record<PaperFormStatus, string> = {
  draft: 'Vytvořené',
  assigned: 'Vytvořené',
  printed: 'Vytištěné',
  distributed: 'Rozdané',
  returned: 'Vrácené',
  scanned: 'Načtené',
  imported: 'Načtené',
  review: 'Čekají na kontrolu',
  approved: 'Schválené',
  rejected: 'Zamítnuto',
  archived: 'Archiv',
}

export const PAPER_FORM_STATUS_VARIANT: Record<
  PaperFormStatus,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  draft: 'neutral',
  assigned: 'info',
  printed: 'neutral',
  distributed: 'info',
  returned: 'warning',
  scanned: 'info',
  imported: 'info',
  review: 'warning',
  approved: 'success',
  rejected: 'danger',
  archived: 'neutral',
}

export const PAPER_FORM_STATUS_FILTERS: { value: PaperFormStatus | ''; label: string }[] = [
  { value: '', label: 'Všechny stavy' },
  { value: 'draft', label: 'Vytvořené' },
  { value: 'printed', label: 'Vytištěné' },
  { value: 'distributed', label: 'Rozdané' },
  { value: 'returned', label: 'Vrácené' },
  { value: 'scanned', label: 'Načtené' },
  { value: 'review', label: 'Čekají na kontrolu' },
  { value: 'approved', label: 'Schválené' },
  { value: 'archived', label: 'Archiv' },
]

export const MONTH_NAMES = [
  'Leden',
  'Únor',
  'Březen',
  'Duben',
  'Květen',
  'Červen',
  'Červenec',
  'Srpen',
  'Září',
  'Říjen',
  'Listopad',
  'Prosinec',
]

export function formatPaperPeriod(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`
}

export type WorkerPaperFormUiStatus = 'none' | 'waiting' | 'imported'

export function mapWorkerPaperFormStatus(status: PaperFormStatus | null | undefined): WorkerPaperFormUiStatus {
  if (!status) return 'none'
  if (['archived', 'approved', 'review', 'imported', 'scanned'].includes(status)) return 'imported'
  if (['printed', 'distributed', 'returned', 'assigned', 'draft'].includes(status)) return 'waiting'
  return 'none'
}

export const WORKER_PAPER_FORM_STATUS = {
  none: { emoji: '🔴', label: 'Formulář nevytvořen', variant: 'danger' as const },
  waiting: { emoji: '🟡', label: 'Formulář vytištěn – čeká na vrácení', variant: 'warning' as const },
  imported: { emoji: '🟢', label: 'Formulář importován', variant: 'success' as const },
}

import type { DiaryEntryStatus } from '@/constants/diary'

/**
 * Stavy deníku započítávané jako platný denní zápis (PDF 8 Fáze 1i).
 * draft / returned / rejected se nepočítají – zápis není dokončený.
 */
export const VALID_DIARY_ENTRY_STATUSES: DiaryEntryStatus[] = [
  'approved',
  'submitted',
  'pending_review',
]

export function isValidDiaryEntryStatus(status: DiaryEntryStatus | string): boolean {
  return (VALID_DIARY_ENTRY_STATUSES as string[]).includes(status)
}

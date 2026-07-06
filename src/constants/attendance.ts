import type { AttendanceStatus } from '@/types/workers'

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  pritomen: 'Přítomen',
  dovolena: 'Dovolená',
  nemoc: 'Nemoc',
  ocr: 'OČR',
  neplacene_volno: 'Neplacené volno',
}

export const ATTENDANCE_STATUS_OPTIONS = (Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatus[]).map(
  (value) => ({
    value,
    label: ATTENDANCE_STATUS_LABELS[value],
  })
)

export function attendanceSourceLabel(formId: string | null | undefined): string {
  return formId ? 'Formulář' : 'Ruční'
}

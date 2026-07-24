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

export const ADMIN_MANUAL_SIGNATURE = 'admin-manual'

export function isPortalAttendanceForm(formSignature: string | null | undefined): boolean {
  return Boolean(formSignature) && formSignature !== ADMIN_MANUAL_SIGNATURE
}

export function canDeleteAttendanceRecord(
  formId: string | null | undefined,
  formSignature?: string | null
): boolean {
  if (!formId) return true
  return formSignature === ADMIN_MANUAL_SIGNATURE
}

export function attendanceSourceLabel(
  formId: string | null | undefined,
  formSignature?: string | null
): string {
  if (!formId) return 'Ruční'
  if (formSignature === ADMIN_MANUAL_SIGNATURE) return 'Ruční (správce)'
  return 'Formulář'
}

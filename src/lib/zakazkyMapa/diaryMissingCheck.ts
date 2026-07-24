import type { JobOrderStatus } from '@/types/orders'
import type { ProjectMarkerColor, ProjectMarkerColorSource } from '@/types/zakazkyMapa'
import { DIARY_CHECK_PAUSED_MANUAL_COLORS } from '@/constants/projectNotifications'
import {
  PROJECT_MARKER_DEFAULT_CHECK_TIME,
  PROJECT_MARKER_DEFAULT_WORKING_DAYS,
} from '@/constants/zakazkyMapa'
import {
  getCompanyLocalDateTime,
  isPastDiaryCheckTime,
  isWorkingDayInTimeZone,
} from '@/lib/zakazkyMapa/companyTime'

export interface DiaryMissingCheckInput {
  orderStatus: JobOrderStatus
  startDate: string
  endDate: string
  validEntryDates: string[]
  workingDays?: number[]
  diaryCheckTime?: string
  timeZone?: string
  referenceAt?: Date
  colorSource?: ProjectMarkerColorSource
  markerColor?: ProjectMarkerColor | null
}

export interface DiaryMissingCheckResult {
  shouldCheck: boolean
  missingDate: string | null
  reason?: string
}

function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b)
}

function isWorkingDay(isoDate: string, workingDays: number[], timeZone: string): boolean {
  return isWorkingDayInTimeZone(isoDate, workingDays, timeZone)
}

export function isDiaryCheckPausedByManualMarker(
  colorSource: ProjectMarkerColorSource | undefined,
  markerColor: ProjectMarkerColor | null | undefined
): boolean {
  if (colorSource !== 'manual' || !markerColor) return false
  return (DIARY_CHECK_PAUSED_MANUAL_COLORS as readonly string[]).includes(markerColor)
}

export function isOrderEligibleForDiaryCheck(
  orderStatus: JobOrderStatus,
  startDate: string,
  endDate: string,
  todayIso: string
): boolean {
  if (orderStatus !== 'aktivni') return false
  if (compareIsoDates(todayIso, startDate) < 0) return false
  if (compareIsoDates(todayIso, endDate) > 0) return false
  return true
}

/**
 * Určí, zda po kontrolním čase chybí platný deník pro daný pracovní den.
 */
export function evaluateDiaryMissingCheck(input: DiaryMissingCheckInput): DiaryMissingCheckResult {
  const workingDays = input.workingDays ?? PROJECT_MARKER_DEFAULT_WORKING_DAYS
  const diaryCheckTime = input.diaryCheckTime ?? PROJECT_MARKER_DEFAULT_CHECK_TIME
  const timeZone = input.timeZone ?? 'Europe/Prague'
  const referenceAt = input.referenceAt ?? new Date()
  const local = getCompanyLocalDateTime(referenceAt, timeZone)
  const validDates = new Set(input.validEntryDates)

  if (isDiaryCheckPausedByManualMarker(input.colorSource, input.markerColor)) {
    return { shouldCheck: false, missingDate: null, reason: 'manual_pause' }
  }

  if (!isOrderEligibleForDiaryCheck(input.orderStatus, input.startDate, input.endDate, local.isoDate)) {
    return { shouldCheck: false, missingDate: null, reason: 'order_ineligible' }
  }

  if (!isWorkingDay(local.isoDate, workingDays, timeZone)) {
    return { shouldCheck: false, missingDate: null, reason: 'non_working_day' }
  }

  if (!isPastDiaryCheckTime(local.minutesOfDay, diaryCheckTime)) {
    return { shouldCheck: false, missingDate: null, reason: 'before_check_time' }
  }

  const missingDate = local.isoDate
  if (validDates.has(missingDate)) {
    return { shouldCheck: false, missingDate: null, reason: 'diary_exists' }
  }

  return { shouldCheck: true, missingDate }
}

export function buildMissingDiaryMessage(orderName: string, location: string, missingDate: string): string {
  const place = location.trim() || '—'
  return `U zakázky „${orderName}“ (${place}) chybí stavební deník za ${missingDate}.`
}

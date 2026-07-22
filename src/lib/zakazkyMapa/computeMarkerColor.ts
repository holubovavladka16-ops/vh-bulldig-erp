import type { ProjectMarkerColor } from '@/types/zakazkyMapa'
import {
  PROJECT_MARKER_APPROACHING_END_DAYS,
  PROJECT_MARKER_AUTO_COLOR_LABELS,
  PROJECT_MARKER_DEFAULT_CHECK_TIME,
  PROJECT_MARKER_DEFAULT_WORKING_DAYS,
  PROJECT_MARKER_LONG_MISSING_WORKING_DAYS,
} from '@/constants/zakazkyMapa'
import { PROJECT_MARKER_MISSING_DIARY_LABEL } from '@/constants/projectNotifications'

export interface MarkerColorComputeInput {
  startDate: string
  endDate: string
  diaryEntryDates: string[]
  diaryCheckTime?: string
  workingDays?: number[]
  /** ISO datum (YYYY-MM-DD) pro „dnes“. */
  today?: string
  /** Aktuální čas pro porovnání s diary_check_time. */
  now?: Date
}

export interface MarkerColorComputeResult {
  color: ProjectMarkerColor
  label: string
  priority: number
}

const COLOR_PRIORITY: Record<ProjectMarkerColor, number> = {
  blue: 1,
  green: 2,
  orange: 3,
  red: 4,
}

function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dateFromIso(iso: string): Date {
  const { y, m, d } = parseIsoDate(iso)
  return new Date(y, m - 1, d)
}

function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b)
}

function addDaysToIso(iso: string, days: number): string {
  const date = dateFromIso(iso)
  date.setDate(date.getDate() + days)
  return toIsoDateLocal(date)
}

function isWorkingDayIso(iso: string, workingDays: number[]): boolean {
  return workingDays.includes(dateFromIso(iso).getDay())
}

function parseCheckTimeMinutes(checkTime: string): number {
  const parts = checkTime.trim().split(':')
  const hours = Number(parts[0] ?? 0)
  const minutes = Number(parts[1] ?? 0)
  return hours * 60 + minutes
}

function isPastDiaryCheckTime(now: Date, checkTime: string): boolean {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return nowMinutes >= parseCheckTimeMinutes(checkTime)
}

function daysBetweenInclusiveStart(fromIso: string, toIso: string): string[] {
  const dates: string[] = []
  let current = fromIso
  while (compareIsoDates(current, toIso) <= 0) {
    dates.push(current)
    current = addDaysToIso(current, 1)
  }
  return dates
}

/** Počet po sobě jdoucích pracovních dní bez zápisu, počítáno zpět od referenceDay. */
export function countConsecutiveMissingWorkingDays(
  referenceDay: string,
  startDate: string,
  entryDates: Set<string>,
  workingDays: number[]
): number {
  let streak = 0
  let current = referenceDay

  while (compareIsoDates(current, startDate) >= 0) {
    if (isWorkingDayIso(current, workingDays)) {
      if (entryDates.has(current)) {
        break
      }
      streak += 1
    }
    current = addDaysToIso(current, -1)
  }

  return streak
}

function getMostRecentWorkingDayOnOrBefore(iso: string, workingDays: number[]): string | null {
  let current = iso
  for (let i = 0; i < 14; i += 1) {
    if (isWorkingDayIso(current, workingDays)) {
      return current
    }
    current = addDaysToIso(current, -1)
  }
  return null
}

function getPreviousWorkingDay(iso: string, workingDays: number[]): string | null {
  let current = addDaysToIso(iso, -1)
  for (let i = 0; i < 14; i += 1) {
    if (isWorkingDayIso(current, workingDays)) {
      return current
    }
    current = addDaysToIso(current, -1)
  }
  return null
}

/**
 * Automatický výpočet barvy špendlíku.
 * Priorita: červená > oranžová > zelená > modrá.
 */
export function computeMarkerAutoColor(input: MarkerColorComputeInput): MarkerColorComputeResult {
  const today = input.today ?? toIsoDateLocal(input.now ?? new Date())
  const now = input.now ?? new Date()
  const workingDays = input.workingDays ?? PROJECT_MARKER_DEFAULT_WORKING_DAYS
  const checkTime = input.diaryCheckTime ?? PROJECT_MARKER_DEFAULT_CHECK_TIME
  const entryDates = new Set(input.diaryEntryDates)

  const candidates: MarkerColorComputeResult[] = []

  if (compareIsoDates(today, input.startDate) < 0) {
    candidates.push({
      color: 'blue',
      label: PROJECT_MARKER_AUTO_COLOR_LABELS.blue,
      priority: COLOR_PRIORITY.blue,
    })
  }

  const isActivePeriod =
    compareIsoDates(today, input.startDate) >= 0 && compareIsoDates(today, input.endDate) <= 0

  if (compareIsoDates(today, input.endDate) > 0) {
    candidates.push({
      color: 'red',
      label: PROJECT_MARKER_AUTO_COLOR_LABELS.red,
      priority: COLOR_PRIORITY.red,
    })
  }

  if (isActivePeriod) {
    if (entryDates.size === 0) {
      candidates.push({
        color: 'red',
        label: PROJECT_MARKER_MISSING_DIARY_LABEL,
        priority: COLOR_PRIORITY.red,
      })
    }

    const missingStreak = countConsecutiveMissingWorkingDays(
      today,
      input.startDate,
      entryDates,
      workingDays
    )

    if (missingStreak >= PROJECT_MARKER_LONG_MISSING_WORKING_DAYS) {
      candidates.push({
        color: 'red',
        label: PROJECT_MARKER_AUTO_COLOR_LABELS.red,
        priority: COLOR_PRIORITY.red,
      })
    }

    const daysToEnd = daysBetweenInclusiveStart(today, input.endDate).length - 1
    if (daysToEnd >= 0 && daysToEnd <= PROJECT_MARKER_APPROACHING_END_DAYS) {
      candidates.push({
        color: 'orange',
        label: PROJECT_MARKER_AUTO_COLOR_LABELS.orange,
        priority: COLOR_PRIORITY.orange,
      })
    }

    if (isWorkingDayIso(today, workingDays)) {
      const hasTodayEntry = entryDates.has(today)
      if (!hasTodayEntry && isPastDiaryCheckTime(now, checkTime)) {
        candidates.push({
          color: 'red',
          label: PROJECT_MARKER_MISSING_DIARY_LABEL,
          priority: COLOR_PRIORITY.red,
        })
      }

      if (!hasTodayEntry) {
        const previousWorkingDay = getPreviousWorkingDay(today, workingDays)
        if (
          previousWorkingDay &&
          compareIsoDates(previousWorkingDay, input.startDate) >= 0 &&
          !entryDates.has(previousWorkingDay)
        ) {
          candidates.push({
            color: 'orange',
            label: PROJECT_MARKER_AUTO_COLOR_LABELS.orange,
            priority: COLOR_PRIORITY.orange,
          })
        }
      }
    } else {
      const lastRequiredDay = getMostRecentWorkingDayOnOrBefore(today, workingDays)
      if (
        lastRequiredDay &&
        compareIsoDates(lastRequiredDay, input.startDate) >= 0 &&
        !entryDates.has(lastRequiredDay)
      ) {
        candidates.push({
          color: 'orange',
          label: PROJECT_MARKER_AUTO_COLOR_LABELS.orange,
          priority: COLOR_PRIORITY.orange,
        })
      }
    }

    const hasCurrentDiary = (() => {
      if (isWorkingDayIso(today, workingDays)) {
        if (entryDates.has(today)) return true
        if (!isPastDiaryCheckTime(now, checkTime)) {
          const prev = getPreviousWorkingDay(today, workingDays)
          return prev != null && entryDates.has(prev)
        }
        return false
      }
      const lastWorking = getMostRecentWorkingDayOnOrBefore(today, workingDays)
      return lastWorking != null && entryDates.has(lastWorking)
    })()

    if (hasCurrentDiary) {
      candidates.push({
        color: 'green',
        label: PROJECT_MARKER_AUTO_COLOR_LABELS.green,
        priority: COLOR_PRIORITY.green,
      })
    }
  }

  if (candidates.length === 0) {
    if (entryDates.size === 0) {
      return {
        color: 'red',
        label: PROJECT_MARKER_MISSING_DIARY_LABEL,
        priority: COLOR_PRIORITY.red,
      }
    }

    if (compareIsoDates(today, input.startDate) < 0) {
      return {
        color: 'blue',
        label: PROJECT_MARKER_AUTO_COLOR_LABELS.blue,
        priority: COLOR_PRIORITY.blue,
      }
    }

    return {
      color: 'red',
      label: PROJECT_MARKER_MISSING_DIARY_LABEL,
      priority: COLOR_PRIORITY.red,
    }
  }

  return candidates.reduce((best, current) => (current.priority > best.priority ? current : best))
}

export { toIsoDateLocal as markerColorTodayIsoLocal }

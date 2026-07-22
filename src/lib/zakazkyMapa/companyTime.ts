const ISO_DATE_PARTS: Intl.DateTimeFormatOptions = {
  timeZone: undefined,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  weekday: 'short',
}

export interface CompanyLocalDateTime {
  isoDate: string
  minutesOfDay: number
  dayOfWeek: number
}

function parseIsoFromParts(year: string, month: string, day: string): string {
  return `${year}-${month}-${day}`
}

/** Vrátí lokální datum/čas ve firemním časovém pásmu. */
export function getCompanyLocalDateTime(at: Date, timeZone: string): CompanyLocalDateTime {
  const formatter = new Intl.DateTimeFormat('en-US', {
    ...ISO_DATE_PARTS,
    timeZone,
  })
  const parts = formatter.formatToParts(at)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekday = lookup.weekday ?? 'Mon'
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  const hour = Number(lookup.hour ?? 0)
  const minute = Number(lookup.minute ?? 0)

  return {
    isoDate: parseIsoFromParts(lookup.year ?? '1970', lookup.month ?? '01', lookup.day ?? '01'),
    minutesOfDay: hour * 60 + minute,
    dayOfWeek: dayMap[weekday] ?? 1,
  }
}

export function parseCheckTimeMinutes(checkTime: string): number {
  const parts = checkTime.trim().split(':')
  const hours = Number(parts[0] ?? 0)
  const minutes = Number(parts[1] ?? 0)
  return hours * 60 + minutes
}

export function isPastDiaryCheckTime(minutesOfDay: number, checkTime: string): boolean {
  return minutesOfDay >= parseCheckTimeMinutes(checkTime)
}

/** Den v týdnu (0=Ne … 6=So) pro ISO datum ve firemním pásmu. */
export function getDayOfWeekInTimeZone(isoDate: string, timeZone: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const local = getCompanyLocalDateTime(probe, timeZone)
  if (local.isoDate === isoDate) return local.dayOfWeek
  const probeEarly = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  return getCompanyLocalDateTime(probeEarly, timeZone).dayOfWeek
}

export function isWorkingDayInTimeZone(isoDate: string, workingDays: number[], timeZone: string): boolean {
  return workingDays.includes(getDayOfWeekInTimeZone(isoDate, timeZone))
}

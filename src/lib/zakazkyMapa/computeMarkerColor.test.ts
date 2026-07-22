import { describe, expect, it } from 'vitest'
import {
  computeMarkerAutoColor,
  countConsecutiveMissingWorkingDays,
  markerColorTodayIsoLocal,
} from '@/lib/zakazkyMapa/computeMarkerColor'

const WORKING_DAYS = [1, 2, 3, 4, 5]

function at(isoDate: string, hours: number, minutes = 0): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d, hours, minutes, 0, 0)
}

describe('computeMarkerAutoColor', () => {
  it('vrátí modrou před zahájením zakázky', () => {
    const result = computeMarkerAutoColor({
      startDate: '2026-08-01',
      endDate: '2026-12-31',
      diaryEntryDates: [],
      today: '2026-07-01',
      workingDays: WORKING_DAYS,
    })

    expect(result.color).toBe('blue')
    expect(result.label).toBe('Čeká na zahájení')
  })

  it('vrátí červenou po termínu dokončení', () => {
    const result = computeMarkerAutoColor({
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      diaryEntryDates: ['2026-06-30'],
      today: '2026-07-15',
      workingDays: WORKING_DAYS,
    })

    expect(result.color).toBe('red')
    expect(result.label).toBe('Vyžaduje zásah')
  })

  it('vrátí oranžovou při chybějícím dnešním zápisu po kontrolním čase', () => {
    const today = '2026-07-22'
    const result = computeMarkerAutoColor({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      diaryEntryDates: ['2026-07-21'],
      today,
      now: at(today, 21, 0),
      diaryCheckTime: '20:00:00',
      workingDays: WORKING_DAYS,
    })

    expect(result.color).toBe('orange')
    expect(result.label).toBe('Vyžaduje kontrolu')
  })

  it('vrátí zelenou s aktuálním zápisem', () => {
    const today = '2026-07-22'
    const result = computeMarkerAutoColor({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      diaryEntryDates: [today],
      today,
      now: at(today, 21, 0),
      workingDays: WORKING_DAYS,
    })

    expect(result.color).toBe('green')
    expect(result.label).toBe('Probíhá v pořádku')
  })

  it('preferuje červenou před oranžovou (priorita)', () => {
    const today = '2026-07-22'
    const result = computeMarkerAutoColor({
      startDate: '2026-01-01',
      endDate: '2026-07-20',
      diaryEntryDates: [],
      today,
      now: at(today, 21, 0),
      workingDays: WORKING_DAYS,
    })

    expect(result.color).toBe('red')
  })

  it('vrátí oranžovou blízko termínu dokončení', () => {
    const today = '2026-07-25'
    const result = computeMarkerAutoColor({
      startDate: '2026-01-01',
      endDate: '2026-07-30',
      diaryEntryDates: [today, '2026-07-24'],
      today,
      now: at(today, 10, 0),
      workingDays: WORKING_DAYS,
    })

    expect(result.color).toBe('orange')
  })

  it('vrátí červenou při dlouhodobě chybějícím deníku', () => {
    const today = '2026-07-22'
    const result = computeMarkerAutoColor({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      diaryEntryDates: ['2026-07-15'],
      today,
      now: at(today, 21, 0),
      workingDays: WORKING_DAYS,
    })

    expect(result.color).toBe('red')
  })
})

describe('countConsecutiveMissingWorkingDays', () => {
  it('počítá po sobě jdoucí pracovní dny bez zápisu', () => {
    const streak = countConsecutiveMissingWorkingDays(
      '2026-07-22',
      '2026-01-01',
      new Set(['2026-07-15']),
      WORKING_DAYS
    )
    expect(streak).toBeGreaterThanOrEqual(3)
  })
})

describe('markerColorTodayIsoLocal', () => {
  it('vrací ISO datum', () => {
    expect(markerColorTodayIsoLocal(new Date(2026, 6, 22, 15, 30))).toBe('2026-07-22')
  })
})

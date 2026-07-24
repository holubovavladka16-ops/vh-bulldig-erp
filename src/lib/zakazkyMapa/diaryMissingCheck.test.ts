import { describe, expect, it } from 'vitest'
import {
  buildMissingDiaryMessage,
  evaluateDiaryMissingCheck,
  isDiaryCheckPausedByManualMarker,
  isOrderEligibleForDiaryCheck,
} from '@/lib/zakazkyMapa/diaryMissingCheck'

const WORKING_DAYS = [1, 2, 3, 4, 5]
const TZ = 'Europe/Prague'

function atPrague(isoDate: string, hours: number, minutes = 0): Date {
  const offset = isoDate >= '2026-03-29' && isoDate < '2026-10-25' ? '+02:00' : '+01:00'
  return new Date(`${isoDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00${offset}`)
}

describe('evaluateDiaryMissingCheck', () => {
  const base = {
    orderStatus: 'aktivni' as const,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    validEntryDates: [] as string[],
    workingDays: WORKING_DAYS,
    diaryCheckTime: '20:00:00',
    timeZone: TZ,
    colorSource: 'auto' as const,
  }

  it('1. před kontrolním časem upozornění nevznikne', () => {
    const result = evaluateDiaryMissingCheck({
      ...base,
      referenceAt: atPrague('2026-07-22', 19, 30),
    })
    expect(result.shouldCheck).toBe(false)
    expect(result.reason).toBe('before_check_time')
  })

  it('2. po kontrolním čase bez deníku upozornění vznikne', () => {
    const result = evaluateDiaryMissingCheck({
      ...base,
      referenceAt: atPrague('2026-07-22', 20, 30),
    })
    expect(result.shouldCheck).toBe(true)
    expect(result.missingDate).toBe('2026-07-22')
  })

  it('10. nepracovní den upozornění nevytvoří', () => {
    const result = evaluateDiaryMissingCheck({
      ...base,
      referenceAt: atPrague('2026-07-26', 21, 0),
    })
    expect(result.shouldCheck).toBe(false)
    expect(result.reason).toBe('non_working_day')
  })

  it('11–13. ruční stavy pozastaví kontrolu', () => {
    for (const color of ['red', 'orange', 'blue'] as const) {
      const result = evaluateDiaryMissingCheck({
        ...base,
        referenceAt: atPrague('2026-07-22', 21, 0),
        colorSource: 'manual',
        markerColor: color,
      })
      expect(result.shouldCheck).toBe(false)
      expect(result.reason).toBe('manual_pause')
    }
  })

  it('14. platný zápis zabrání upozornění', () => {
    const result = evaluateDiaryMissingCheck({
      ...base,
      validEntryDates: ['2026-07-22'],
      referenceAt: atPrague('2026-07-22', 21, 0),
    })
    expect(result.shouldCheck).toBe(false)
    expect(result.reason).toBe('diary_exists')
  })

  it('nepustí kontrolu u neaktivní zakázky', () => {
    const result = evaluateDiaryMissingCheck({
      ...base,
      orderStatus: 'dokoncena',
      referenceAt: atPrague('2026-07-22', 21, 0),
    })
    expect(result.shouldCheck).toBe(false)
  })
})

describe('isDiaryCheckPausedByManualMarker', () => {
  it('pozastaví ruční červenou, oranžovou a modrou', () => {
    expect(isDiaryCheckPausedByManualMarker('manual', 'red')).toBe(true)
    expect(isDiaryCheckPausedByManualMarker('manual', 'orange')).toBe(true)
    expect(isDiaryCheckPausedByManualMarker('manual', 'blue')).toBe(true)
    expect(isDiaryCheckPausedByManualMarker('manual', 'green')).toBe(false)
    expect(isDiaryCheckPausedByManualMarker('auto', 'red')).toBe(false)
  })
})

describe('buildMissingDiaryMessage', () => {
  it('obsahuje název, místo a datum', () => {
    const message = buildMissingDiaryMessage('Zakázka A', 'Praha', '2026-07-22')
    expect(message).toContain('Zakázka A')
    expect(message).toContain('Praha')
    expect(message).toContain('2026-07-22')
  })
})

describe('isOrderEligibleForDiaryCheck', () => {
  it('povolí pouze aktivní zakázku v termínu', () => {
    expect(isOrderEligibleForDiaryCheck('aktivni', '2026-01-01', '2026-12-31', '2026-07-22')).toBe(true)
    expect(isOrderEligibleForDiaryCheck('pozastavena', '2026-01-01', '2026-12-31', '2026-07-22')).toBe(false)
    expect(isOrderEligibleForDiaryCheck('aktivni', '2026-01-01', '2026-12-31', '2025-12-31')).toBe(false)
  })
})

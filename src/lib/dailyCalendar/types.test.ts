import { describe, expect, it } from 'vitest'
import { hasAnyMissingData, listMissingDataMessages, type OrderDaySummary } from '@/lib/dailyCalendar/types'

function makeSummary(overrides: Partial<OrderDaySummary> = {}): OrderDaySummary {
  return {
    date: '2026-07-20',
    orderId: 'order-1',
    orderName: 'Zakázka Litomyšl',
    diaryFilled: true,
    photosCount: 10,
    costsTotal: 12450,
    wagesTotal: 21600,
    dailyTotal: 34050,
    missingDiary: false,
    missingPhotos: false,
    missingCosts: false,
    missingAttendance: false,
    computedAt: '2026-07-20T23:59:00Z',
    ...overrides,
  }
}

describe('hasAnyMissingData', () => {
  it('vrátí false, pokud nic nechybí', () => {
    expect(hasAnyMissingData(makeSummary())).toBe(false)
  })

  it('vrátí true, pokud chybí jen deník', () => {
    expect(hasAnyMissingData(makeSummary({ missingDiary: true }))).toBe(true)
  })

  it('vrátí true při více chybějících údajích současně', () => {
    const summary = makeSummary({ missingPhotos: true, missingCosts: true })
    expect(hasAnyMissingData(summary)).toBe(true)
  })
})

describe('listMissingDataMessages', () => {
  it('vrátí prázdný seznam, pokud nic nechybí', () => {
    expect(listMissingDataMessages(makeSummary())).toEqual([])
  })

  it('vrátí správnou hlášku pro chybějící stavební deník', () => {
    const messages = listMissingDataMessages(makeSummary({ missingDiary: true }))
    expect(messages).toContain('Chybí stavební deník.')
    expect(messages).toHaveLength(1)
  })

  it('vrátí správnou hlášku pro chybějící fotografie', () => {
    const messages = listMissingDataMessages(makeSummary({ missingPhotos: true }))
    expect(messages).toContain('Chybí fotografie.')
  })

  it('vrátí správnou hlášku pro chybějící náklady', () => {
    const messages = listMissingDataMessages(makeSummary({ missingCosts: true }))
    expect(messages).toContain('Chybí náklady.')
  })

  it('vrátí správnou hlášku pro chybějící docházku', () => {
    const messages = listMissingDataMessages(makeSummary({ missingAttendance: true }))
    expect(messages).toContain('Chybí docházka pro výpočet výplat.')
  })

  it('vrátí všechny hlášky najednou při více chybějících údajích', () => {
    const messages = listMissingDataMessages(
      makeSummary({ missingDiary: true, missingPhotos: true, missingCosts: true, missingAttendance: true })
    )
    expect(messages).toHaveLength(4)
  })
})

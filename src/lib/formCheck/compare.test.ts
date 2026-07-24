import { describe, expect, it } from 'vitest'
import { compareFormWithAttendance } from '@/lib/formCheck/compare'
import { normalizeNumber, numbersEqual, orderCodesEqual } from '@/lib/formCheck/normalize'
import type { ErpAttendanceDay, FormCheckOcrResult } from '@/types/formCheck'

function makeOcrResult(
  lines: FormCheckOcrResult['lines'],
  overrides: Partial<FormCheckOcrResult> = {}
): FormCheckOcrResult {
  return {
    workerName: 'Novák Jan',
    monthLabel: 'Červen 2026',
    month: 6,
    year: 2026,
    lines,
    summary: {
      totalHours: null,
      totalBm: null,
      totalPenetrations: null,
      totalAdvance: null,
    },
    overallConfidence: 0.95,
    aiModel: 'gemini-2.0-flash',
    storagePath: null,
    ...overrides,
  }
}

const erpDay: ErpAttendanceDay = {
  date: '2026-06-05',
  hours: 8,
  orderCode: 'ZK-015',
  orderName: 'Zakázka 15',
  manualDigBm: 12,
  penetrationKs: 2,
  advance: 500,
  note: '',
}

describe('normalize', () => {
  it('treats 8, 8.0 and 8:00 as equal', () => {
    expect(numbersEqual('8', '8.0')).toBe(true)
    expect(numbersEqual('8', '8:00')).toBe(true)
    expect(normalizeNumber('8,5')).toBe(8.5)
  })

  it('normalizes order codes case-insensitively', () => {
    expect(orderCodesEqual('zk-015', 'ZK-015')).toBe(true)
  })
})

describe('compareFormWithAttendance', () => {
  it('reports full match when all fields agree', () => {
    const ocr = makeOcrResult([
      {
        formDate: '2026-06-05',
        orderCode: 'ZK-015',
        orderName: null,
        performanceHours: 8,
        manualDigBm: 12,
        penetrationKs: 2,
        dailyAdvance: 500,
        note: '',
        confidence: 0.98,
      },
    ])

    const result = compareFormWithAttendance(ocr, [erpDay])
    expect(result.outcome).toBe('match')
    expect(result.differenceCount).toBe(0)
    expect(result.items.every((i) => i.status === 'match')).toBe(true)
  })

  it('detects different hours', () => {
    const ocr = makeOcrResult([
      {
        formDate: '2026-06-05',
        orderCode: 'ZK-015',
        orderName: null,
        performanceHours: 10,
        manualDigBm: null,
        penetrationKs: null,
        dailyAdvance: null,
        note: '',
        confidence: 0.98,
      },
    ])

    const result = compareFormWithAttendance(ocr, [erpDay])
    const hoursItem = result.items.find((i) => i.field === 'hours')
    expect(hoursItem?.status).toBe('mismatch')
    expect(result.outcome).toBe('mismatch')
  })

  it('detects different order code', () => {
    const ocr = makeOcrResult([
      {
        formDate: '2026-06-05',
        orderCode: 'ZK-018',
        orderName: null,
        performanceHours: 8,
        manualDigBm: null,
        penetrationKs: null,
        dailyAdvance: null,
        note: '',
        confidence: 0.91,
      },
    ])

    const result = compareFormWithAttendance(ocr, [erpDay])
    const orderItem = result.items.find((i) => i.field === 'order')
    expect(orderItem?.status).toBe('mismatch')
  })

  it('marks missing day in ERP', () => {
    const ocr = makeOcrResult([
      {
        formDate: '2026-06-07',
        orderCode: 'ZK-015',
        orderName: null,
        performanceHours: 8,
        manualDigBm: null,
        penetrationKs: null,
        dailyAdvance: null,
        note: '',
        confidence: 0.95,
      },
    ])

    const result = compareFormWithAttendance(ocr, [])
    expect(result.items.some((i) => i.status === 'missing_in_erp')).toBe(true)
    expect(result.outcome).toBe('mismatch')
  })

  it('does not compare unfilled form fields', () => {
    const ocr = makeOcrResult([
      {
        formDate: '2026-06-05',
        orderCode: 'ZK-015',
        orderName: null,
        performanceHours: 8,
        manualDigBm: null,
        penetrationKs: null,
        dailyAdvance: null,
        note: '',
        confidence: 0.95,
      },
    ])

    const result = compareFormWithAttendance(ocr, [erpDay])
    expect(result.items.some((i) => i.field === 'manual_dig')).toBe(false)
  })

  it('flags low confidence instead of definitive mismatch', () => {
    const result = compareFormWithAttendance(
      makeOcrResult(
        [
          {
            formDate: '2026-06-05',
            orderCode: 'ZK-015',
            orderName: null,
            performanceHours: 10,
            manualDigBm: null,
            penetrationKs: null,
            dailyAdvance: null,
            note: '',
            confidence: 0.75,
          },
        ],
        { overallConfidence: 0.75 }
      ),
      [erpDay]
    )
    const hoursItem = result.items.find((i) => i.field === 'hours')
    expect(hoursItem?.status).toBe('low_confidence')
    expect(result.outcome).toBe('manual_review')
  })

  it('matches same hours in different formats', () => {
    const ocr = makeOcrResult([
      {
        formDate: '2026-06-05',
        orderCode: 'ZK-015',
        orderName: null,
        performanceHours: 8,
        manualDigBm: null,
        penetrationKs: null,
        dailyAdvance: null,
        note: '',
        confidence: 0.95,
      },
    ])

    const erp: ErpAttendanceDay = { ...erpDay, hours: 8.0 }
    const result = compareFormWithAttendance(ocr, [erp])
    const hoursItem = result.items.find((i) => i.field === 'hours')
    expect(hoursItem?.status).toBe('match')
  })
})

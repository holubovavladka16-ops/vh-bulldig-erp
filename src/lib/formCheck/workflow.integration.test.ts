import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidQrFormIdPayload } from '@/lib/formCheck/api'
import { compareFormWithAttendance } from '@/lib/formCheck/compare'
import { buildFormCheckPdfBlob, getFormCheckPdfFilename } from '@/lib/formCheck/pdf'
import { computeFormCheckStats } from '@/lib/formCheck/records'
import {
  createInitialFormCheckState,
  transitionCompareComplete,
  transitionOcrComplete,
  transitionToCapture,
  transitionToConfirm,
  transitionToOcr,
  transitionToResult,
} from '@/lib/formCheck/workflow'
import type {
  ErpAttendanceDay,
  FormCheckComparisonResult,
  FormCheckContext,
  FormCheckOcrResult,
  FormCheckRecordDetail,
} from '@/types/formCheck'

vi.mock('@/lib/print/pdfFont', () => ({
  ensurePdfFonts: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase', () => {
  const records: Array<Record<string, unknown>> = []

  return {
    supabase: {
      from: (table: string) => {
        if (table !== 'form_check_records') {
          throw new Error(`Unexpected table: ${table}`)
        }

        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const id = `rec-${records.length + 1}`
                records.push({ id, ...row })
                return { data: { id }, error: null }
              },
            }),
          }),
          select: () => ({
            order: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      async then() {
                        return { data: records, error: null }
                      },
                    }),
                  }),
                }),
              }),
            }),
            then: async (resolve: (v: { data: typeof records; error: null }) => void) =>
              resolve({ data: records, error: null }),
          }),
        }
      },
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: { signedUrl: 'https://example.com/photo.jpg' }, error: null }),
        }),
      },
    },
  }
})

const context: FormCheckContext = {
  formId: 'form-1',
  publicId: 'PMF-ABCD',
  formNumber: 'PM-2026-001',
  workerId: 'worker-1',
  workerName: 'Novák Jan',
  month: 6,
  year: 2026,
  periodLabel: 'Červen 2026',
  status: 'distributed',
  needsWorkerAssignment: false,
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

const ocrResult: FormCheckOcrResult = {
  workerName: 'Novák Jan',
  monthLabel: 'Červen 2026',
  month: 6,
  year: 2026,
  lines: [
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
  ],
  summary: {
    totalHours: 8,
    totalBm: 12,
    totalPenetrations: 2,
    totalAdvance: 500,
  },
  overallConfidence: 0.95,
  aiModel: 'gemini-2.0-flash',
  storagePath: 'form-check/form-1/scan.jpg',
}

describe('form check workflow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates QR payload and walks through workflow phases', () => {
    expect(isValidQrFormIdPayload('PMF-ABCD')).toBe(true)
    expect(isValidQrFormIdPayload('PM-2026-001')).toBe(true)
    expect(isValidQrFormIdPayload('invalid')).toBe(false)

    let state = createInitialFormCheckState()
    expect(state.phase).toBe('scan')

    state = transitionToConfirm(state, context)
    expect(state.phase).toBe('confirm')
    expect(state.context?.formNumber).toBe('PM-2026-001')

    state = transitionToCapture(state)
    expect(state.phase).toBe('capture')

    state = transitionToOcr(state, 'blob:preview')
    expect(state.phase).toBe('ocr')
    expect(state.capturedImagePreviewUrl).toBe('blob:preview')

    state = transitionOcrComplete(state, ocrResult, 'form-check/form-1/scan.jpg')
    expect(state.ocrResult?.overallConfidence).toBe(0.95)

    const comparison = compareFormWithAttendance(ocrResult, [erpDay])
    state = transitionCompareComplete(state, comparison)
    expect(state.phase).toBe('compare')
    expect(state.comparisonResult?.outcome).toBe('match')

    state = transitionToResult(state, 'rec-1')
    expect(state.phase).toBe('result')
    expect(state.savedRecordId).toBe('rec-1')
  })

  it('compares OCR with attendance without mutating ERP data', () => {
    const erpCopy = structuredClone([erpDay])
    const comparison = compareFormWithAttendance(ocrResult, erpCopy)

    expect(comparison.outcome).toBe('match')
    expect(comparison.differenceCount).toBe(0)
    expect(erpCopy).toEqual([erpDay])
  })

  it('saves check record with full JSON payloads', async () => {
    const { saveFormCheckRecord } = await import('@/lib/formCheck/records')
    const comparison = compareFormWithAttendance(ocrResult, [erpDay])

    const id = await saveFormCheckRecord({
      formId: context.formId,
      formNumber: context.formNumber,
      workerId: context.workerId!,
      month: context.month,
      year: context.year,
      outcome: comparison.outcome,
      differenceCount: comparison.differenceCount,
      ocrConfidence: ocrResult.overallConfidence,
      ocrResult,
      comparisonResult: comparison,
      photoPath: 'form-check/form-1/scan.jpg',
      checkedBy: 'user-1',
    })

    expect(id).toBe('rec-1')
  })

  it('computes history stats from record list', () => {
    const matchComparison = compareFormWithAttendance(ocrResult, [erpDay])
    const mismatchOcr: FormCheckOcrResult = {
      ...ocrResult,
      lines: [{ ...ocrResult.lines[0]!, performanceHours: 10 }],
      overallConfidence: 0.7,
    }
    const mismatchComparison = compareFormWithAttendance(mismatchOcr, [erpDay])

    const records = [
      {
        id: 'rec-1',
        formId: context.formId,
        formNumber: context.formNumber,
        workerId: context.workerId!,
        workerName: context.workerName!,
        month: context.month,
        year: context.year,
        periodLabel: context.periodLabel,
        checkedAt: new Date().toISOString(),
        outcome: matchComparison.outcome,
        differenceCount: matchComparison.differenceCount,
        ocrConfidence: 0.95,
        photoPath: null,
        checkedById: 'user-1',
        checkedByName: 'Tester',
      },
      {
        id: 'rec-2',
        formId: context.formId,
        formNumber: context.formNumber,
        workerId: context.workerId!,
        workerName: context.workerName!,
        month: context.month,
        year: context.year,
        periodLabel: context.periodLabel,
        checkedAt: new Date().toISOString(),
        outcome: mismatchComparison.outcome,
        differenceCount: mismatchComparison.differenceCount,
        ocrConfidence: 0.7,
        photoPath: null,
        checkedById: 'user-2',
        checkedByName: 'Tester 2',
      },
    ]

    const stats = computeFormCheckStats(records)
    expect(stats.totalChecks).toBe(2)
    expect(stats.matchCount).toBe(1)
    expect(stats.mismatchCount).toBe(1)
    expect(stats.ocrSuccessRate).toBe(50)
    expect(stats.averageConfidence).toBe(83)
  })

  it('exports PDF with comparison summary', async () => {
    const comparison: FormCheckComparisonResult = compareFormWithAttendance(ocrResult, [erpDay])
    const record: FormCheckRecordDetail = {
      id: 'rec-1',
      formId: context.formId,
      formNumber: context.formNumber,
      workerId: context.workerId!,
      workerName: context.workerName!,
      month: context.month,
      year: context.year,
      periodLabel: context.periodLabel,
      checkedAt: new Date().toISOString(),
      outcome: comparison.outcome,
      differenceCount: comparison.differenceCount,
      ocrConfidence: ocrResult.overallConfidence,
      photoPath: 'form-check/form-1/scan.jpg',
      checkedById: 'user-1',
      checkedByName: 'Tester',
      ocrResult,
      comparisonResult: comparison,
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['fake-image'], { type: 'image/jpeg' }),
    }) as unknown as typeof fetch

    const blob = await buildFormCheckPdfBlob(record, null)
    expect(blob.type).toBe('application/pdf')
    expect(getFormCheckPdfFilename(record)).toContain('PM-2026-001')
  })
})

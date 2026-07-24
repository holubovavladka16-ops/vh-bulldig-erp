import {
  formatNumberForDisplay,
  isEmptyValue,
  isZeroOrEmpty,
  normalizeDate,
  normalizeNumber,
  numbersEqual,
  OCR_LOW_CONFIDENCE_THRESHOLD,
  orderCodesEqual,
  textsEqual,
} from '@/lib/formCheck/normalize'
import type {
  CompareFieldKey,
  CompareItem,
  CompareItemStatus,
  CompareOutcome,
  CompareSummaryRow,
  ErpAttendanceDay,
  FormCheckComparisonResult,
  FormCheckOcrLine,
  FormCheckOcrResult,
} from '@/types/formCheck'

export type {
  CompareFieldKey,
  CompareItem,
  CompareItemStatus,
  CompareOutcome,
  CompareSummaryRow,
  ErpAttendanceDay,
  FormCheckComparisonResult,
}

export const COMPARE_FIELD_LABELS: Record<CompareFieldKey, string> = {
  hours: 'Hodiny',
  order: 'Zakázka',
  manual_dig: 'Ruční výkop',
  penetration: 'Protlaky',
  advance: 'Záloha',
  note: 'Poznámka',
}

function hasFilledFormLine(line: FormCheckOcrLine): boolean {
  return (
    !isZeroOrEmpty(line.performanceHours) ||
    !isEmptyValue(line.orderCode) ||
    !isEmptyValue(line.orderName) ||
    !isZeroOrEmpty(line.manualDigBm) ||
    !isZeroOrEmpty(line.penetrationKs) ||
    !isZeroOrEmpty(line.dailyAdvance) ||
    !isEmptyValue(line.note)
  )
}

function formatOrderDisplay(code: string | null, name: string | null): string {
  const parts = [code, name].filter((p) => p && p.trim())
  return parts.length > 0 ? parts.join(' – ') : '—'
}

function formatHoursDisplay(value: number | null): string {
  if (value == null) return '—'
  return formatNumberForDisplay(value, ' h')
}

function resolveCompareStatus(
  valuesMatch: boolean,
  formHasValue: boolean,
  erpHasValue: boolean,
  confidence: number | null
): CompareItemStatus {
  if (!formHasValue && !erpHasValue) return 'not_compared'
  if (formHasValue && !erpHasValue) return 'missing_in_erp'
  if (!formHasValue && erpHasValue) return 'missing_on_form'

  if (valuesMatch) return 'match'

  if (confidence != null && confidence < OCR_LOW_CONFIDENCE_THRESHOLD) {
    return 'low_confidence'
  }

  return 'mismatch'
}

function compareField(
  date: string,
  field: CompareFieldKey,
  formValue: string | number | null | undefined,
  erpValue: string | number | null | undefined,
  confidence: number | null,
  options: {
    compareAsNumber?: boolean
    compareAsOrder?: boolean
    onlyIfFormFilled?: boolean
  } = {}
): CompareItem | null {
  const formEmpty = options.compareAsNumber || options.compareAsOrder
    ? isZeroOrEmpty(formValue) && isEmptyValue(formValue)
    : isEmptyValue(formValue)
  const erpEmpty = options.compareAsNumber || options.compareAsOrder
    ? isZeroOrEmpty(erpValue) && isEmptyValue(erpValue)
    : isEmptyValue(erpValue)

  if (options.onlyIfFormFilled && formEmpty) return null

  let valuesMatch = false
  if (options.compareAsNumber) {
    valuesMatch = numbersEqual(formValue, erpValue)
  } else if (options.compareAsOrder) {
    valuesMatch = orderCodesEqual(String(formValue ?? ''), String(erpValue ?? ''))
  } else {
    valuesMatch = textsEqual(String(formValue ?? ''), String(erpValue ?? ''))
  }

  const status = resolveCompareStatus(!formEmpty || !erpEmpty ? valuesMatch : true, !formEmpty, !erpEmpty, confidence)

  if (status === 'not_compared') return null

  let erpDisplay = '—'
  let formDisplay = '—'

  if (field === 'hours') {
    erpDisplay = formatHoursDisplay(normalizeNumber(erpValue))
    formDisplay = formatHoursDisplay(normalizeNumber(formValue))
  } else if (field === 'order') {
    erpDisplay = String(erpValue ?? '—')
    formDisplay = String(formValue ?? '—')
  } else if (field === 'manual_dig') {
    erpDisplay = formatNumberForDisplay(normalizeNumber(erpValue), ' m')
    formDisplay = formatNumberForDisplay(normalizeNumber(formValue), ' m')
  } else if (field === 'penetration') {
    erpDisplay = formatNumberForDisplay(normalizeNumber(erpValue), ' ks')
    formDisplay = formatNumberForDisplay(normalizeNumber(formValue), ' ks')
  } else if (field === 'advance') {
    erpDisplay = formatNumberForDisplay(normalizeNumber(erpValue), ' Kč')
    formDisplay = formatNumberForDisplay(normalizeNumber(formValue), ' Kč')
  } else {
    erpDisplay = String(erpValue ?? '—')
    formDisplay = String(formValue ?? '—')
  }

  return {
    date,
    field,
    fieldLabel: COMPARE_FIELD_LABELS[field],
    erpValue: erpDisplay,
    formValue: formDisplay,
    status,
    confidence,
  }
}

function sumNumbers(values: Array<number | null | undefined>): number | null {
  const nums = values.map((v) => normalizeNumber(v)).filter((v): v is number => v != null)
  if (nums.length === 0) return null
  return nums.reduce((acc, n) => acc + n, 0)
}

export function compareFormWithAttendance(
  ocrResult: FormCheckOcrResult,
  erpDays: ErpAttendanceDay[]
): FormCheckComparisonResult {
  const filledLines = ocrResult.lines.filter(hasFilledFormLine)
  const erpByDate = new Map<string, ErpAttendanceDay>()
  for (const day of erpDays) {
    erpByDate.set(normalizeDate(day.date), day)
  }

  const items: CompareItem[] = []

  for (const line of filledLines) {
    const date = normalizeDate(line.formDate)
    const erp = erpByDate.get(date) ?? null
    const confidence = line.confidence

    const comparisons: Array<CompareItem | null> = [
      compareField(date, 'hours', line.performanceHours, erp?.hours ?? null, confidence, {
        compareAsNumber: true,
        onlyIfFormFilled: true,
      }),
      compareField(
        date,
        'order',
        line.orderCode ?? line.orderName,
        erp?.orderCode ?? erp?.orderName,
        confidence,
        { compareAsOrder: true, onlyIfFormFilled: true }
      ),
      compareField(date, 'manual_dig', line.manualDigBm, erp?.manualDigBm ?? null, confidence, {
        compareAsNumber: true,
        onlyIfFormFilled: true,
      }),
      compareField(date, 'penetration', line.penetrationKs, erp?.penetrationKs ?? null, confidence, {
        compareAsNumber: true,
        onlyIfFormFilled: true,
      }),
      compareField(date, 'advance', line.dailyAdvance, erp?.advance ?? null, confidence, {
        compareAsNumber: true,
        onlyIfFormFilled: true,
      }),
    ]

    if (!isEmptyValue(line.note)) {
      comparisons.push(
        compareField(date, 'note', line.note, erp?.note ?? null, confidence, {
          onlyIfFormFilled: true,
        })
      )
    }

    if (!erp) {
      for (const item of comparisons) {
        if (!item) continue
        if (item.status !== 'not_compared') {
          items.push({ ...item, status: 'missing_in_erp', erpValue: '—' })
        }
      }
      continue
    }

    for (const item of comparisons) {
      if (item) items.push(item)
    }
  }

  const comparedDays = new Set(items.map((i) => i.date)).size
  const formTotalHours = sumNumbers(filledLines.map((l) => l.performanceHours))
  const erpTotalHours = sumNumbers(
    filledLines.map((l) => erpByDate.get(normalizeDate(l.formDate))?.hours)
  )

  const summaryRows: CompareSummaryRow[] = []

  const summaryDefs: Array<{
    field: CompareFieldKey
    formTotal: number | null
    erpTotal: number | null
    suffix: string
  }> = [
    {
      field: 'hours',
      formTotal: ocrResult.summary.totalHours ?? formTotalHours,
      erpTotal: erpTotalHours,
      suffix: ' h',
    },
    {
      field: 'manual_dig',
      formTotal: ocrResult.summary.totalBm ?? sumNumbers(filledLines.map((l) => l.manualDigBm)),
      erpTotal: sumNumbers(
        filledLines.map((l) => erpByDate.get(normalizeDate(l.formDate))?.manualDigBm)
      ),
      suffix: ' m',
    },
    {
      field: 'penetration',
      formTotal:
        ocrResult.summary.totalPenetrations ?? sumNumbers(filledLines.map((l) => l.penetrationKs)),
      erpTotal: sumNumbers(
        filledLines.map((l) => erpByDate.get(normalizeDate(l.formDate))?.penetrationKs)
      ),
      suffix: ' ks',
    },
    {
      field: 'advance',
      formTotal: ocrResult.summary.totalAdvance ?? sumNumbers(filledLines.map((l) => l.dailyAdvance)),
      erpTotal: sumNumbers(filledLines.map((l) => erpByDate.get(normalizeDate(l.formDate))?.advance)),
      suffix: ' Kč',
    },
  ]

  for (const def of summaryDefs) {
    if (def.formTotal == null && def.erpTotal == null) continue
    const valuesMatch = numbersEqual(def.formTotal, def.erpTotal)
    const status: CompareItemStatus = valuesMatch
      ? 'match'
      : ocrResult.overallConfidence != null &&
          ocrResult.overallConfidence < OCR_LOW_CONFIDENCE_THRESHOLD
        ? 'low_confidence'
        : 'mismatch'

    summaryRows.push({
      field: def.field,
      fieldLabel: `Součet – ${COMPARE_FIELD_LABELS[def.field]}`,
      erpTotal: def.erpTotal,
      formTotal: def.formTotal,
      status,
      confidence: ocrResult.overallConfidence,
    })

    if (!valuesMatch && def.formTotal != null) {
      items.push({
        date: 'součet',
        field: def.field,
        fieldLabel: `Součet – ${COMPARE_FIELD_LABELS[def.field]}`,
        erpValue: formatNumberForDisplay(def.erpTotal, def.suffix),
        formValue: formatNumberForDisplay(def.formTotal, def.suffix),
        status,
        confidence: ocrResult.overallConfidence,
      })
    }
  }

  const problemStatuses: CompareItemStatus[] = ['mismatch', 'missing_in_erp', 'missing_on_form']
  const differenceCount = items.filter((i) => problemStatuses.includes(i.status)).length
  const needsManualReview = items.some((i) => i.status === 'low_confidence')

  let outcome: CompareOutcome = 'match'
  if (differenceCount > 0) {
    outcome = 'mismatch'
  } else if (needsManualReview) {
    outcome = 'manual_review'
  }

  return {
    outcome,
    comparedDays,
    comparedItems: items.length,
    differenceCount,
    formTotalHours,
    erpTotalHours,
    items,
    summaryRows,
    needsManualReview,
  }
}

export function sortCompareItems(items: CompareItem[]): CompareItem[] {
  const statusOrder: Record<CompareItemStatus, number> = {
    mismatch: 0,
    low_confidence: 1,
    missing_in_erp: 2,
    missing_on_form: 3,
    match: 4,
    not_compared: 5,
  }

  return [...items].sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff
    if (a.date === 'součet' && b.date !== 'součet') return -1
    if (b.date === 'součet' && a.date !== 'součet') return 1
    return a.date.localeCompare(b.date)
  })
}

export function getErpOrderDisplay(day: ErpAttendanceDay): string {
  return formatOrderDisplay(day.orderCode, day.orderName)
}

// Re-export helpers used in tests
export { normalizeNumber, numbersEqual, orderCodesEqual }

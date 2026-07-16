import { formatCurrency, formatDate } from '@/constants/workers'
import { buildPayrollSlipTitle } from '@/lib/payroll/payrollReport'
import { VectorPdfDocument } from '@/lib/print/vectorPdfDocument'
import { companySettingsToHeader } from '@/lib/print/printDocument'
import type { CompanySettings } from '@/types'
import type { PayrollSlipDetail } from '@/types/payroll'

const MONTH_NAMES = [
  'leden',
  'únor',
  'březen',
  'duben',
  'květen',
  'červen',
  'červenec',
  'srpen',
  'září',
  'říjen',
  'listopad',
  'prosinec',
]

function formatPeriodLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`
}

function formatPerformance(report: PayrollSlipDetail['reports'][number]): string {
  const parts: string[] = []
  if (report.hours > 0) parts.push(`${report.hours} hod`)
  if (report.meters > 0) parts.push(`${report.meters} bm`)
  if (report.pieces > 0) parts.push(`${report.pieces} ks`)
  if (report.activity?.trim()) parts.push(report.activity.trim())
  return parts.join(' · ') || '—'
}

export async function buildPayrollSlipPdfBlob(
  detail: PayrollSlipDetail,
  company: CompanySettings
): Promise<Blob> {
  const header = companySettingsToHeader(company)
  const pdf = new VectorPdfDocument(header)
  await pdf.prepare()

  const documentNumber = `VP-${detail.period.year}-${String(detail.period.month).padStart(2, '0')}-${detail.summary.worker_id.slice(0, 8)}`
  pdf.drawCompanyHeader({
    title: buildPayrollSlipTitle(detail),
    documentNumber,
  })

  pdf.drawSectionTitle('Údaje o zaměstnanci')
  pdf.drawKeyValueRows([
    {
      label: 'Zaměstnanec',
      value: `${detail.summary.worker_first_name} ${detail.summary.worker_last_name}`,
    },
    { label: 'Období', value: formatPeriodLabel(detail.period.year, detail.period.month) },
    { label: 'Počet schválených výkazů', value: String(detail.summary.report_count) },
    ...(company.bank_account ? [{ label: 'Bankovní účet', value: company.bank_account }] : []),
  ])

  pdf.drawSectionTitle('Přehled odpracovaných výkonů')
  pdf.drawTable(
    [
      { header: 'Datum', widthRatio: 0.14 },
      { header: 'Zakázka', widthRatio: 0.22 },
      { header: 'Výkon', widthRatio: 0.34 },
      { header: 'Výdělek', widthRatio: 0.15, align: 'right' },
      { header: 'Záloha', widthRatio: 0.15, align: 'right' },
    ],
    detail.reports.map((report) => [
      formatDate(report.report_date),
      report.order_name || '—',
      formatPerformance(report),
      formatCurrency(report.earnings),
      formatCurrency(report.advance ?? 0),
    ])
  )

  pdf.drawSectionTitle('Vyúčtování')
  pdf.drawTable(
    [
      { header: 'Položka', widthRatio: 0.65 },
      { header: 'Částka', widthRatio: 0.35, align: 'right' },
    ],
    [
      ['Celkový výdělek', formatCurrency(detail.summary.total_earnings)],
      ['Vyplacené zálohy', formatCurrency(detail.summary.total_advances)],
      ['Konečná částka k výplatě', formatCurrency(detail.summary.net_amount)],
    ]
  )

  return pdf.toBlob()
}

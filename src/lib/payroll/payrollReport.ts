import { formatCurrency, formatDate } from '@/constants/workers'
import {
  buildProfessionalDocumentFooter,
  buildProfessionalDocumentHeader,
  buildProfessionalPrintDocument,
  companySettingsToHeader,
  escHtml,
  formatDocumentCreatedAt,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
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

const PAYROLL_PRINT_EXTRA = `
  .payroll-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .payroll-table th, .payroll-table td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11pt; vertical-align: top; }
  .payroll-table th { background: #f5f5f5; }
  .payroll-table .num { text-align: right; white-space: nowrap; }
  .payroll-totals { margin-top: 16px; max-width: 380px; margin-left: auto; }
  .net-row th, .net-row td { font-weight: bold; background: #f0f7ff; }
`

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

function resolveCompanyHeader(company: CompanySettings): CompanyHeader {
  return companySettingsToHeader(company)
}

export function buildPayrollSlipTitle(detail: PayrollSlipDetail): string {
  const { summary, period } = detail
  return `Výplatní páska – ${summary.worker_last_name} ${summary.worker_first_name} – ${formatPeriodLabel(period.year, period.month)}`
}

function buildPayrollSlipBodyHtml(detail: PayrollSlipDetail, company: CompanySettings): string {
  const { summary, period, reports } = detail

  const performanceRows = reports
    .map(
      (report) => `
        <tr>
          <td>${escHtml(formatDate(report.report_date))}</td>
          <td>${escHtml(report.order_name || '—')}</td>
          <td>${escHtml(formatPerformance(report))}</td>
          <td class="num">${escHtml(formatCurrency(report.earnings))}</td>
          <td class="num">${escHtml(formatCurrency(report.advance ?? 0))}</td>
        </tr>
      `
    )
    .join('')

  return `
    <section class="doc-section">
      <h2>Údaje o zaměstnanci</h2>
      <div class="doc-kv">
        <span class="k">Zaměstnanec</span><span>${escHtml(summary.worker_first_name)} ${escHtml(summary.worker_last_name)}</span>
        <span class="k">Období</span><span>${escHtml(formatPeriodLabel(period.year, period.month))}</span>
        <span class="k">Počet schválených výkazů</span><span>${escHtml(summary.report_count)}</span>
        ${company.bank_account ? `<span class="k">Bankovní účet</span><span>${escHtml(company.bank_account)}</span>` : ''}
      </div>
    </section>

    <section class="doc-section">
      <h2>Přehled odpracovaných výkonů</h2>
      <table class="payroll-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Zakázka</th>
            <th>Výkon</th>
            <th>Výdělek</th>
            <th>Záloha</th>
          </tr>
        </thead>
        <tbody>${performanceRows}</tbody>
      </table>
    </section>

    <section class="doc-section">
      <h2>Vyúčtování</h2>
      <table class="payroll-table payroll-totals">
        <tr><th>Celkový výdělek</th><td class="num">${escHtml(formatCurrency(summary.total_earnings))}</td></tr>
        <tr><th>Vyplacené zálohy</th><td class="num">${escHtml(formatCurrency(summary.total_advances))}</td></tr>
        <tr class="net-row"><th>Konečná částka k výplatě</th><td class="num">${escHtml(formatCurrency(summary.net_amount))}</td></tr>
      </table>
    </section>
  `
}

export function buildPayrollSlipDocument(detail: PayrollSlipDetail, company: CompanySettings): string {
  const headerCompany = resolveCompanyHeader(company)
  const createdAt = formatDocumentCreatedAt()
  const documentNumber = `VP-${detail.period.year}-${String(detail.period.month).padStart(2, '0')}-${detail.summary.worker_id.slice(0, 8)}`
  const meta = {
    title: 'Výplatní páska',
    documentNumber,
    createdAt,
  }
  const content = `${buildProfessionalDocumentHeader(headerCompany, meta)}${buildPayrollSlipBodyHtml(detail, company)}${buildProfessionalDocumentFooter(headerCompany, createdAt)}`
  return buildProfessionalPrintDocument(buildPayrollSlipTitle(detail), content, {
    company: headerCompany,
    extraStyles: PAYROLL_PRINT_EXTRA,
  })
}

export function openPayrollSlipReport(detail: PayrollSlipDetail, company: CompanySettings): void {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(buildPayrollSlipDocument(detail, company))
  win.document.close()
}

export function printPayrollSlipReport(detail: PayrollSlipDetail, company: CompanySettings): void {
  openPrintDocument(buildPayrollSlipDocument(detail, company))
}

export function downloadPayrollSlipReport(detail: PayrollSlipDetail, company: CompanySettings): void {
  const html = buildPayrollSlipDocument(detail, company)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `vyplatni_paska_${detail.summary.worker_last_name}_${detail.period.year}_${String(detail.period.month).padStart(2, '0')}.html`
  link.click()
  URL.revokeObjectURL(url)
}

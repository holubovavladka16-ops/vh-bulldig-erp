import { formatCurrency, formatDate } from '@/constants/workers'
import {
  buildDiaryStylePrintDocument,
  companySettingsToHeader,
  escHtml,
  formatDocumentCreatedAt,
  kvRow,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import {
  downloadProfessionalPdf,
  previewProfessionalPdf,
  printProfessionalPdf,
  type ProfessionalPdfOptions,
} from '@/lib/print/professionalPdfExport'
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
      <h2>Zaměstnanec</h2>
      <div class="doc-kv">
        ${kvRow('Jméno', `${summary.worker_first_name} ${summary.worker_last_name}`)}
        ${kvRow('Období', formatPeriodLabel(period.year, period.month))}
        ${kvRow('Počet schválených výkazů', summary.report_count)}
        ${company.bank_account ? kvRow('Bankovní účet', company.bank_account) : ''}
      </div>
    </section>

    <section class="doc-section">
      <h2>Docházka</h2>
      <table class="doc-table doc-table-attendance">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Zakázka</th>
            <th>Začátek</th>
            <th>Konec</th>
            <th>Přestávka</th>
            <th>Hodiny</th>
          </tr>
        </thead>
        <tbody>
          ${reports
            .map(
              (report) => `
            <tr>
              <td>${escHtml(formatDate(report.report_date))}</td>
              <td>${escHtml(report.order_name || '—')}</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td class="num">${escHtml(`${report.hours ?? 0} h`)}</td>
            </tr>`
            )
            .join('') || '<tr><td colspan="6">Žádné záznamy docházky</td></tr>'}
        </tbody>
      </table>
      <div class="doc-note-box">Docházka slouží pouze jako evidence přítomnosti. K výdělku se přičítají pouze samostatně zadané výkony z ceníku.</div>
    </section>

    <section class="doc-section">
      <h2>Schválené výkony</h2>
      <table class="doc-table doc-table-payroll">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Zakázka</th>
            <th>Výkon</th>
            <th>Výdělek</th>
            <th>Záloha</th>
          </tr>
        </thead>
        <tbody>${performanceRows || '<tr><td colspan="5">Žádné výkony</td></tr>'}</tbody>
      </table>
    </section>

    <section class="doc-section summary-section">
      <h2>Rekapitulace výplaty</h2>
      <table class="doc-table doc-table-kv doc-table-totals doc-summary-table">
        <tbody>
          <tr><th>Celkový výdělek</th><td class="num">${escHtml(formatCurrency(summary.total_earnings))}</td></tr>
          <tr><th>Vyplacené zálohy</th><td class="num">${escHtml(formatCurrency(summary.total_advances))}</td></tr>
          <tr class="net-row"><th>Částka k výplatě</th><td class="num">${escHtml(formatCurrency(summary.net_amount))}</td></tr>
        </tbody>
      </table>
    </section>

    <section class="doc-section doc-section-signatures signature-section">
      <h2>Podpisy</h2>
      <div class="doc-signatures">
        <div class="doc-sign-box">
          <div class="doc-sign-line">Podpis zaměstnance</div>
          <div class="doc-sign-role">Datum a podpis</div>
        </div>
        <div class="doc-sign-box">
          <div class="doc-sign-line">Schválil / podpis odpovědné osoby</div>
          <div class="doc-sign-role">Datum, razítko a podpis</div>
        </div>
      </div>
    </section>
  `
}

/** Stejná struktura jako buildDiaryReportDocument. */
export function buildPayrollSlipDocument(detail: PayrollSlipDetail, company: CompanySettings): string {
  const headerCompany = resolveCompanyHeader(company)
  const createdAt = formatDocumentCreatedAt()
  const documentNumber = `VP-${detail.period.year}-${String(detail.period.month).padStart(2, '0')}-${detail.summary.worker_id.slice(0, 8)}`
  return buildDiaryStylePrintDocument(
    buildPayrollSlipTitle(detail),
    {
      title: 'Výplatní páska',
      documentNumber,
      createdAt,
      employeeName: `${detail.summary.worker_first_name} ${detail.summary.worker_last_name}`,
      periodLabel: formatPeriodLabel(detail.period.year, detail.period.month),
    },
    buildPayrollSlipBodyHtml(detail, company),
    headerCompany
  )
}

function payrollPdfOptions(detail: PayrollSlipDetail): ProfessionalPdfOptions {
  const { summary, period } = detail
  return {
    fileName: `vyplatni-paska-${summary.worker_last_name}-${period.year}-${String(period.month).padStart(2, '0')}.pdf`,
    title: buildPayrollSlipTitle(detail),
    shareText: buildPayrollSlipTitle(detail),
  }
}

export function previewPayrollSlipPdf(detail: PayrollSlipDetail, company: CompanySettings): void {
  previewProfessionalPdf(buildPayrollSlipDocument(detail, company), payrollPdfOptions(detail))
}

export function printPayrollSlipReport(detail: PayrollSlipDetail, company: CompanySettings): void {
  printProfessionalPdf(buildPayrollSlipDocument(detail, company), payrollPdfOptions(detail))
}

export async function downloadPayrollSlipReport(detail: PayrollSlipDetail, company: CompanySettings): Promise<void> {
  const opts = payrollPdfOptions(detail)
  await downloadProfessionalPdf(buildPayrollSlipDocument(detail, company), opts.fileName ?? 'vyplatni-paska.pdf')
}

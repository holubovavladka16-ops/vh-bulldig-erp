import { PRICE_UNIT_LABELS, WORKER_REPORT_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'
import { getFormPhotoUrl } from '@/lib/workers/module5'
import { formatTimeForInput } from '@/lib/workers/attendance'
import {
  buildDiaryStylePrintDocument,
  escHtml,
  formatDocumentCreatedAt,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import {
  downloadProfessionalPdf,
  previewProfessionalPdf,
  printProfessionalPdf,
  type ProfessionalPdfOptions,
} from '@/lib/print/professionalPdfExport'
import type { ReportDetail } from '@/types/workers'

/** Denní záloha dle firemní praxe VH Bulldig. */
export const DAILY_ADVANCE_AMOUNT = 500

export function buildDailyReportTitle(detail: ReportDetail): string {
  const workerName = `${detail.worker.first_name} ${detail.worker.last_name}`
  return `Denní výkaz – ${workerName} – ${formatDate(detail.report.report_date)}`
}

function formatPresenceDuration(form: NonNullable<ReportDetail['form']>, reportHours: number): string {
  if (form.work_start && form.work_end) {
    const breakPart = form.break_minutes > 0 ? ` (přestávka ${form.break_minutes} min)` : ''
    return `${formatTimeForInput(form.work_start)} – ${formatTimeForInput(form.work_end)}${breakPart}`
  }
  return `${reportHours} h`
}

export function buildReportPrintHtml(detail: ReportDetail): string {
  const { report, form, worker, task_items, photos } = detail
  const workerName = `${worker.first_name} ${worker.last_name}`
  const reportDate = formatDate(report.report_date)
  const orderName = report.order_name || '—'
  const workDescription = form?.work_description?.trim() || form?.activity?.trim() || '—'

  const workRows = task_items
    .map(
      (item) =>
        `<tr>
          <td>${escHtml(reportDate)}</td>
          <td>${escHtml(orderName)}</td>
          <td>${escHtml(workDescription)}</td>
          <td>${escHtml(item.name)}</td>
          <td class="num">${escHtml(item.quantity)}</td>
          <td>${escHtml(PRICE_UNIT_LABELS[item.unit_type])}</td>
          <td class="num">${escHtml(formatCurrency(item.price))}</td>
          <td class="num">${escHtml(formatCurrency(item.line_earnings))}</td>
        </tr>`
    )
    .join('')

  const photoHtml = photos
    .map(
      (p) =>
        `<div class="doc-photo-block"><img src="${escHtml(getFormPhotoUrl(p.file_path))}" alt="${escHtml(p.file_name)}" /></div>`
    )
    .join('')

  const netPayout = Math.max(0, report.earnings - DAILY_ADVANCE_AMOUNT)

  const attendanceSection = form
    ? `<section class="doc-section">
      <h2>Docházka</h2>
      <table class="doc-table doc-table-report-daily-attendance">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Zakázka</th>
            <th>Začátek práce</th>
            <th>Konec práce</th>
            <th>Přestávka</th>
            <th>Doba přítomnosti</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escHtml(reportDate)}</td>
            <td>${escHtml(orderName)}</td>
            <td>${escHtml(form.work_start ? formatTimeForInput(form.work_start) : '—')}</td>
            <td>${escHtml(form.work_end ? formatTimeForInput(form.work_end) : '—')}</td>
            <td>${escHtml(form.break_minutes ? `${form.break_minutes} min` : '—')}</td>
            <td>${escHtml(formatPresenceDuration(form, report.hours))}</td>
          </tr>
        </tbody>
      </table>
      <div class="doc-note-box">Docházka slouží pouze jako evidence přítomnosti. K výdělku se přičítají pouze samostatně zadané výkony z ceníku.</div>
    </section>`
    : ''

  return `
    ${attendanceSection}

    <section class="doc-section">
      <h2>Vykázané práce</h2>
      <table class="doc-table doc-table-report-works">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Zakázka</th>
            <th>Popis práce</th>
            <th>Položka ceníku</th>
            <th>Množství</th>
            <th>Jednotka</th>
            <th>Jedn. cena</th>
            <th>Částka</th>
          </tr>
        </thead>
        <tbody>${workRows || '<tr><td colspan="8">Žádné výkony</td></tr>'}</tbody>
      </table>
    </section>

    <section class="doc-section summary-section">
      <h2>Rekapitulace výplaty</h2>
      <table class="doc-table doc-table-kv doc-table-totals doc-summary-table">
        <tbody>
          <tr><th>Celkový výdělek</th><td class="num">${escHtml(formatCurrency(report.earnings))}</td></tr>
          <tr><th>Záloha</th><td class="num">${escHtml(formatCurrency(DAILY_ADVANCE_AMOUNT))}</td></tr>
          <tr class="net-row"><th>Částka k výplatě</th><td class="num">${escHtml(formatCurrency(netPayout))}</td></tr>
        </tbody>
      </table>
    </section>

    ${report.note?.trim() ? `<section class="doc-section"><h2>Poznámka</h2><p class="doc-text">${escHtml(report.note)}</p></section>` : ''}
    ${report.material?.trim() ? `<section class="doc-section"><h2>Materiál</h2><p class="doc-text">${escHtml(report.material)}</p></section>` : ''}
    ${photoHtml ? `<section class="doc-section"><h2>Fotodokumentace</h2>${photoHtml}</section>` : ''}

    <section class="doc-section doc-section-signatures signature-section">
      <h2>Podpisy</h2>
      <div class="doc-signatures">
        <div class="doc-sign-box">
          ${form?.signature_data ? `<img src="${escHtml(form.signature_data)}" class="doc-sign-img" alt="Podpis zaměstnance" />` : ''}
          <div class="doc-sign-line">Podpis zaměstnance</div>
          <div class="doc-sign-role">${escHtml(workerName)}</div>
        </div>
        <div class="doc-sign-box">
          <div class="doc-sign-line">Schválil / podpis odpovědné osoby</div>
          <div class="doc-sign-role">Datum, razítko a podpis</div>
        </div>
      </div>
    </section>

    <section class="doc-section">
      <div class="doc-kv doc-kv-compact">
        <span class="k">Stav výkazu</span><span>${escHtml(WORKER_REPORT_STATUS_LABELS[report.status])}</span>
        <span class="k">Pozice</span><span>${escHtml(worker.position || '—')}</span>
      </div>
    </section>
  `
}

/** Stejná struktura jako buildDiaryReportDocument – header + boxy + footer v buildProfessionalPrintDocument. */
export function buildReportPrintDocument(detail: ReportDetail, company?: CompanyHeader | null): string {
  const workerName = `${detail.worker.first_name} ${detail.worker.last_name}`
  const pageTitle = buildDailyReportTitle(detail)
  return buildDiaryStylePrintDocument(
    pageTitle,
    {
      title: 'Denní výkaz zaměstnance',
      documentNumber: `VYK-${detail.report.id.slice(0, 8).toUpperCase()}`,
      createdAt: formatDocumentCreatedAt(),
      employeeName: workerName,
      periodLabel: formatDate(detail.report.report_date),
    },
    buildReportPrintHtml(detail),
    company
  )
}

function reportPdfOptions(detail: ReportDetail): ProfessionalPdfOptions {
  const workerName = `${detail.worker.first_name} ${detail.worker.last_name}`
  return {
    fileName: `Denni-vykaz-${workerName}-${detail.report.report_date}.pdf`,
    title: `Denní výkaz – ${workerName}`,
    shareText: `Denní výkaz – ${workerName} – ${formatDate(detail.report.report_date)}`,
  }
}

export function previewDailyReportPdf(detail: ReportDetail, company?: CompanyHeader | null): void {
  previewProfessionalPdf(buildReportPrintDocument(detail, company), reportPdfOptions(detail))
}

export function printDailyReportPdf(detail: ReportDetail, company?: CompanyHeader | null): void {
  printProfessionalPdf(buildReportPrintDocument(detail, company), reportPdfOptions(detail))
}

export async function downloadDailyReportPdf(detail: ReportDetail, company?: CompanyHeader | null): Promise<void> {
  const opts = reportPdfOptions(detail)
  await downloadProfessionalPdf(buildReportPrintDocument(detail, company), opts.fileName ?? 'denni-vykaz.pdf')
}

import { formatCurrency, formatDate } from '@/constants/workers'
import {
  buildProfessionalReportDocument,
  downloadHtmlDocument,
  escHtml,
  openPreviewDocument,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { CompanySettings } from '@/types'
import { INVOICEABLE_REPORT_STATUS_LABELS, type InvoiceableWorkReportDetail } from '@/types/invoiceableWorkReports'

const REPORT_PAGE_MARGIN = '4mm'

const REPORT_PRINT_CSS = `
  @page { size: A4 portrait; margin: ${REPORT_PAGE_MARGIN}; }
  html, body {
    width: 210mm !important;
    min-height: 297mm !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }
  .doc-shell {
    width: 210mm !important;
    max-width: 210mm !important;
    margin: 0 auto !important;
    padding: ${REPORT_PAGE_MARGIN} !important;
    box-sizing: border-box !important;
  }
  @media print {
    .doc-shell { padding: 0 !important; }
  }
  .doc-footer {
    left: ${REPORT_PAGE_MARGIN} !important;
    right: ${REPORT_PAGE_MARGIN} !important;
    bottom: ${REPORT_PAGE_MARGIN} !important;
  }
  body.has-doc-footer { padding-bottom: 14mm !important; }
  .iwr-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin: 8px 0 14px; font-size: 10pt; }
  .iwr-meta-grid .label { color: #666; }
  .iwr-order-subtotal { margin: 4px 0 14px; }
  .iwr-order-subtotal table { width: 100%; border-collapse: collapse; }
  .iwr-order-subtotal td { padding: 5px 8px; border-bottom: 1px solid #d9e2ef; }
  .iwr-order-subtotal td.amount { text-align: right; font-weight: 600; }
  .iwr-grand-total { margin-top: 12px; text-align: right; font-size: 13pt; font-weight: 700; color: #1e3a5f; }
  .iwr-signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 56px;
    margin-top: 32px;
    page-break-inside: avoid;
  }
  .iwr-sign-box { min-height: 24mm; border-top: 1px solid #333; padding-top: 6px; margin-top: 24mm; text-align: center; font-size: 9.5pt; color: #666; }
`

function metaRow(label: string, value: string | null | undefined): string {
  if (!value) return ''
  return `<div><span class="label">${escHtml(label)}:</span> ${escHtml(value)}</div>`
}

function buildLinesTableHtml(report: InvoiceableWorkReportDetail): string {
  const rows = report.lines
    .map(
      (line) => `
        <tr>
          <td>${escHtml(formatDate(line.work_date))}</td>
          <td>${escHtml(line.order_name ?? '—')}</td>
          <td>${escHtml(line.item_name)}</td>
          <td>${escHtml(line.unit)}</td>
          <td class="num">${escHtml(line.quantity)}</td>
          <td class="num">${escHtml(formatCurrency(line.unit_price))}</td>
          <td class="num">${escHtml(formatCurrency(line.line_total))}</td>
        </tr>
      `
    )
    .join('')

  return `
    <table class="doc-table">
      <thead>
        <tr>
          <th>Datum</th>
          <th>Zakázka</th>
          <th>Položka</th>
          <th>MJ</th>
          <th class="num">Množství</th>
          <th class="num">Cena/MJ</th>
          <th class="num">Celkem</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildOrderSubtotalsHtml(report: InvoiceableWorkReportDetail): string {
  const byOrder = new Map<string, { name: string; total: number }>()
  for (const line of report.lines) {
    const current = byOrder.get(line.order_id) ?? { name: line.order_name ?? 'Neznámá zakázka', total: 0 }
    current.total += line.line_total
    byOrder.set(line.order_id, current)
  }
  const rows = [...byOrder.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)

  const rowsHtml = rows
    .map((r) => `<tr><td>${escHtml(r.name)}</td><td class="amount">${escHtml(formatCurrency(r.total))}</td></tr>`)
    .join('')

  return `
    <section class="doc-section">
      <h2>Součty podle zakázek</h2>
      <div class="iwr-order-subtotal">
        <table>${rowsHtml}</table>
      </div>
      <p class="iwr-grand-total">Celkem za výkaz: ${escHtml(formatCurrency(grandTotal))}</p>
    </section>
  `
}

export function buildReportBodyHtml(report: InvoiceableWorkReportDetail): string {
  return `
    <section class="doc-section">
      <div class="iwr-meta-grid">
        ${metaRow('Období', `${formatDate(report.period_from)} – ${formatDate(report.period_to)}`)}
        ${metaRow('Stav', INVOICEABLE_REPORT_STATUS_LABELS[report.status])}
        ${metaRow('Objednatel', report.customer_name)}
        ${metaRow('Číslo smlouvy', report.contract_number)}
        ${metaRow('Číslo objednávky', report.purchase_order_number)}
      </div>
      ${report.note ? `<p class="doc-text">${escHtml(report.note)}</p>` : ''}
    </section>

    <section class="doc-section">
      <h2>Položky výkazu</h2>
      ${buildLinesTableHtml(report)}
    </section>

    ${buildOrderSubtotalsHtml(report)}

    <section class="iwr-signatures">
      <div class="iwr-sign-box">Podpis zhotovitele</div>
      <div class="iwr-sign-box">Podpis objednatele</div>
    </section>
  `
}

export function buildReportDocument(
  report: InvoiceableWorkReportDetail,
  company?: CompanyHeader | CompanySettings | null
): string {
  return buildProfessionalReportDocument(
    {
      title: 'FAKTURAČNÍ VÝKAZ PRACÍ',
      documentNumber: report.name,
      extraStyles: REPORT_PRINT_CSS,
    },
    buildReportBodyHtml(report),
    company
  )
}

export function printReportDocument(
  report: InvoiceableWorkReportDetail,
  company?: CompanyHeader | CompanySettings | null
): void {
  openPrintDocument(buildReportDocument(report, company))
}

export function previewReportDocument(
  report: InvoiceableWorkReportDetail,
  company?: CompanyHeader | CompanySettings | null
): void {
  openPreviewDocument(buildReportDocument(report, company))
}

export function downloadReportDocumentHtml(
  report: InvoiceableWorkReportDetail,
  company?: CompanyHeader | CompanySettings | null
): void {
  downloadHtmlDocument(buildReportDocument(report, company), `fakturacni_vykaz_${report.id}.html`)
}

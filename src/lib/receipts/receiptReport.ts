import { formatCurrency, formatDate, formatTime } from '@/constants/workers'
import { getReceiptPhotoUrl } from '@/lib/receipts/api'
import {
  buildProfessionalReportDocument,
  downloadHtmlDocument,
  escHtml,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { Receipt } from '@/types/receipts'

function row(label: string, value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return `<tr><th>${escHtml(label)}</th><td>${escHtml(value)}</td></tr>`
}

export function buildReceiptTitle(receipt: Receipt): string {
  return `Paragon – ${receipt.expense_name} – ${formatDate(receipt.receipt_date)}`
}

export function buildReceiptReportHtml(receipt: Receipt): string {
  const photoUrl = getReceiptPhotoUrl(receipt.file_path)
  const hasGps = receipt.gps_lat != null && receipt.gps_lng != null

  return `
    <section class="doc-section">
      <div class="doc-photo-wrap">
        <img src="${escHtml(photoUrl)}" alt="Paragon" />
      </div>
    </section>

    <section class="doc-section">
      <h2>Údaje o výdaji</h2>
      <table class="doc-table">
        ${row('Datum', formatDate(receipt.receipt_date))}
        ${row('Zakázka', receipt.order_name ?? '')}
        ${row('Název výdaje', receipt.expense_name)}
        ${row('Cena', receipt.amount != null ? formatCurrency(receipt.amount) : '')}
        ${row('Dodavatel', receipt.supplier)}
        ${row('Poznámka', receipt.note)}
      </table>
    </section>

    <section class="doc-section">
      <h2>Údaje o pořízení fotografie</h2>
      <table class="doc-table">
        ${row('Datum pořízení', formatDate(receipt.captured_date))}
        ${row('Čas pořízení', formatTime(receipt.captured_time))}
        ${row('GPS souřadnice', hasGps ? `${receipt.gps_lat!.toFixed(6)}, ${receipt.gps_lng!.toFixed(6)}` : '')}
        ${row('Adresa', receipt.address_full)}
      </table>
    </section>
  `
}

export function buildReceiptReportDocument(receipt: Receipt, company?: CompanyHeader | null): string {
  return buildProfessionalReportDocument(
    {
      title: 'Paragon k zaúčtování',
      documentNumber: `PAR-${receipt.id.slice(0, 8).toUpperCase()}`,
    },
    buildReceiptReportHtml(receipt),
    company
  )
}

export function openReceiptReport(receipt: Receipt, company?: CompanyHeader | null): void {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(buildReceiptReportDocument(receipt, company))
  win.document.close()
}

export function printReceiptReport(receipt: Receipt, company?: CompanyHeader | null): void {
  openPrintDocument(buildReceiptReportDocument(receipt, company))
}

export function downloadReceiptReportHtml(receipt: Receipt, company?: CompanyHeader | null): void {
  downloadHtmlDocument(
    buildReceiptReportDocument(receipt, company),
    `paragon_${receipt.receipt_date}_${receipt.id.slice(0, 8)}.html`
  )
}

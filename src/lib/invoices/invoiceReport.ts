import { formatCurrency, formatDate } from '@/constants/workers'
import { getInvoiceAssetUrl } from '@/lib/invoices/api'
import { resolveVatRate } from '@/lib/invoices/calculations'
import { buildQrPaymentUrl, buildSpaydString } from '@/lib/invoices/spaydQr'
import {
  buildProfessionalReportDocument,
  downloadHtmlDocument,
  escHtml,
  openPrintDocument,
} from '@/lib/print/printDocument'
import {
  INVOICE_STATUS_LABELS,
  INVOICE_TEXT_PRESETS,
  type InvoiceSettings,
  type IssuedInvoice,
} from '@/types/invoices'

const INVOICE_PAGE_MARGIN = '4mm'

const INVOICE_PRINT_CSS = `
  @page { size: A4 portrait; margin: ${INVOICE_PAGE_MARGIN}; }
  html, body {
    width: 210mm !important;
    min-height: 297mm !important;
    max-height: 297mm !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }
  .doc-shell {
    width: 210mm !important;
    max-width: 210mm !important;
    min-height: 297mm !important;
    max-height: 297mm !important;
    margin: 0 auto !important;
    padding: ${INVOICE_PAGE_MARGIN} !important;
    box-sizing: border-box !important;
  }
  @media print {
    .doc-shell { padding: 0 !important; }
  }
  .doc-footer {
    left: ${INVOICE_PAGE_MARGIN} !important;
    right: ${INVOICE_PAGE_MARGIN} !important;
    bottom: ${INVOICE_PAGE_MARGIN} !important;
  }
  body.has-doc-footer { padding-bottom: 14mm !important; }
  .doc-header { border-bottom-color: #b8860b !important; margin-bottom: 14px !important; }
  .doc-title-block { margin-bottom: 14px !important; }
  .doc-company-name, .doc-title, .doc-section h2, .doc-party h3 { color: #1a1a1a !important; }
  .doc-table th { background: #f5f0e1 !important; color: #1a1a1a !important; border-color: #d4af37 !important; }
  .doc-table td { border-color: #e8dcc0 !important; }
  .doc-party { border-color: #d4af37 !important; background: #fffdf8 !important; }
  .doc-section { margin: 11px 0 !important; }
  .doc-parties { margin: 8px 0 12px !important; gap: 16px !important; }
  .doc-meta-grid { margin: 6px 0 10px !important; gap: 6px 20px !important; }
  .doc-text { margin: 0 !important; }
  .invoice-gold { color: #b8860b; font-weight: 700; }
  .invoice-totals { margin-top: 12px; max-width: 300px; margin-left: auto; }
  .invoice-totals table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .invoice-totals td { padding: 5px 0; border-bottom: 1px solid #e8dcc0; vertical-align: baseline; }
  .invoice-totals td.label { width: 58%; text-align: left; color: #666; padding-right: 12px; }
  .invoice-totals td.amount {
    width: 42%;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    padding-left: 8px;
    letter-spacing: 0.01em;
  }
  .invoice-totals tr.grand-row td { border-bottom: none; border-top: 2px solid #b8860b; padding-top: 7px; }
  .invoice-totals .grand { font-size: 11.5pt; font-weight: 700; color: #1a1a1a; }
  .invoice-qr-wrap { text-align: center; margin: 10px 0 6px; page-break-inside: avoid; }
  .invoice-qr-wrap img { width: 36mm; height: 36mm; border: 1px solid #d4af37; padding: 4px; background: #fff; }
  .invoice-qr-wrap p { margin: 4px 0 0; font-size: 9.5pt; }
  .invoice-signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 56px;
    margin-top: 22px;
    align-items: end;
    page-break-inside: avoid;
  }
  .invoice-signatures img { max-height: 24mm; max-width: 100%; object-fit: contain; }
  .invoice-sign-box { min-height: 28mm; display: flex; align-items: flex-end; justify-content: center; }
  .invoice-sign-caption { margin-top: 6px; font-size: 9pt; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 4px; }
  .doc-watermark { opacity: 0.035 !important; }
`

function invoiceIntroText(invoice: IssuedInvoice): string {
  if (invoice.text_variant === 'vlastni') return invoice.custom_text.trim()
  return INVOICE_TEXT_PRESETS[invoice.text_variant]
}

function paymentMethodLabel(method: IssuedInvoice['payment_method']): string {
  return method === 'hotovost' ? 'Hotovost' : 'Bankovní převod'
}

function supplierBlock(settings: InvoiceSettings): string {
  const lines = [
    settings.company_name,
    settings.ico ? `IČO: ${settings.ico}` : '',
    settings.dic ? `DIČ: ${settings.dic}` : '',
    [settings.address, settings.postal_code, settings.city].filter(Boolean).join(', '),
    settings.phone ? `Tel.: ${settings.phone}` : '',
    settings.email ? `E-mail: ${settings.email}` : '',
    settings.website ? settings.website : '',
  ].filter(Boolean)

  return lines.map((line) => `<p>${escHtml(line)}</p>`).join('')
}

function customerBlock(invoice: IssuedInvoice): string {
  const lines = [
    invoice.customer_name,
    invoice.customer_ico ? `IČO: ${invoice.customer_ico}` : '',
    invoice.customer_dic ? `DIČ: ${invoice.customer_dic}` : '',
    [invoice.customer_address, invoice.customer_postal_code, invoice.customer_city].filter(Boolean).join(', '),
  ].filter(Boolean)

  return lines.map((line) => `<p>${escHtml(line)}</p>`).join('')
}

function buildLinesTable(invoice: IssuedInvoice): string {
  const lines = invoice.lines ?? []
  const rows = lines
    .map((line) => {
      const vatRate = resolveVatRate(invoice.vat_mode, line.vat_rate)
      const lineTotal = Math.round(line.quantity * line.unit_price * 100) / 100
      return `
        <tr>
          <td>${escHtml(line.name)}</td>
          <td class="num">${escHtml(line.quantity)}</td>
          <td>${escHtml(line.unit)}</td>
          <td class="num">${escHtml(formatCurrency(line.unit_price))}</td>
          <td class="num">${invoice.vat_mode === 'none' ? '—' : `${vatRate} %`}</td>
          <td class="num">${escHtml(formatCurrency(lineTotal))}</td>
        </tr>
      `
    })
    .join('')

  return `
    <table class="doc-table">
      <thead>
        <tr>
          <th>Název</th>
          <th class="num">Množství</th>
          <th>MJ</th>
          <th class="num">Cena</th>
          <th class="num">DPH</th>
          <th class="num">Celkem</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildTotalsBlock(invoice: IssuedInvoice): string {
  return `
    <div class="invoice-totals">
      <table>
        <tr><td class="label">Celkem bez DPH</td><td class="amount">${escHtml(formatCurrency(invoice.subtotal))}</td></tr>
        <tr><td class="label">DPH</td><td class="amount">${escHtml(formatCurrency(invoice.vat_amount))}</td></tr>
        <tr class="grand-row"><td class="label grand">Celkem k úhradě</td><td class="amount grand">${escHtml(formatCurrency(invoice.total))}</td></tr>
      </table>
    </div>
  `
}

function buildQrBlock(invoice: IssuedInvoice, settings: InvoiceSettings): string {
  if (invoice.payment_method !== 'bankovni_prevod') return ''
  const spayd = buildSpaydString({
    account: settings.bank_account,
    amount: invoice.total,
    variableSymbol: invoice.variable_symbol,
    message: `Faktura ${invoice.invoice_number}`,
  })
  if (!spayd) return ''

  return `
    <section class="doc-section">
      <h2>QR platba</h2>
      <div class="invoice-qr-wrap">
        <img src="${escHtml(buildQrPaymentUrl(spayd))}" alt="QR platba" />
        <p>Variabilní symbol: <span class="invoice-gold">${escHtml(invoice.variable_symbol)}</span></p>
        ${settings.bank_account ? `<p>Účet: ${escHtml(settings.bank_account)}${settings.bank_name ? ` (${escHtml(settings.bank_name)})` : ''}</p>` : ''}
      </div>
    </section>
  `
}

function buildSignaturesBlock(settings: InvoiceSettings): string {
  const signature = getInvoiceAssetUrl(settings.signature_path)
  const stamp = getInvoiceAssetUrl(settings.stamp_path)

  return `
    <section class="invoice-signatures">
      <div>
        ${signature ? `<div class="invoice-sign-box"><img src="${escHtml(signature)}" alt="Podpis" /></div>` : '<div class="invoice-sign-box"></div>'}
        <div class="invoice-sign-caption">Podpis</div>
      </div>
      <div>
        ${stamp ? `<div class="invoice-sign-box"><img src="${escHtml(stamp)}" alt="Razítko" /></div>` : '<div class="invoice-sign-box"></div>'}
        <div class="invoice-sign-caption">Razítko</div>
      </div>
    </section>
  `
}

export function buildInvoiceReportHtml(invoice: IssuedInvoice, settings: InvoiceSettings): string {
  return `
    <section class="doc-section">
      <div class="doc-parties">
        <div class="doc-party">
          <h3>Dodavatel</h3>
          ${supplierBlock(settings)}
        </div>
        <div class="doc-party">
          <h3>Odběratel</h3>
          ${customerBlock(invoice)}
        </div>
      </div>
    </section>

    <section class="doc-section">
      <div class="doc-meta-grid">
        <div><span class="label">Datum vystavení:</span> ${escHtml(formatDate(invoice.issue_date))}</div>
        <div><span class="label">Datum uskutečnění plnění:</span> ${escHtml(invoice.taxable_date ? formatDate(invoice.taxable_date) : '—')}</div>
        <div><span class="label">Datum splatnosti:</span> ${escHtml(invoice.due_date ? formatDate(invoice.due_date) : '—')}</div>
        <div><span class="label">Způsob platby:</span> ${escHtml(paymentMethodLabel(invoice.payment_method))}</div>
        <div><span class="label">Variabilní symbol:</span> <span class="invoice-gold">${escHtml(invoice.variable_symbol)}</span></div>
        <div><span class="label">Stav:</span> ${escHtml(INVOICE_STATUS_LABELS[invoice.status])}</div>
      </div>
    </section>

    <section class="doc-section">
      <p class="doc-text"><strong>${escHtml(invoiceIntroText(invoice))}</strong></p>
    </section>

    <section class="doc-section">
      ${buildLinesTable(invoice)}
      ${buildTotalsBlock(invoice)}
    </section>

    ${buildQrBlock(invoice, settings)}
    ${buildSignaturesBlock(settings)}
  `
}

export function buildInvoiceReportDocument(invoice: IssuedInvoice, settings: InvoiceSettings): string {
  const logo = getInvoiceAssetUrl(settings.logo_path)
  const companyHeader = {
    company_name: settings.company_name,
    logo_url: logo ?? '',
    watermark_url: logo ?? '',
    tagline: 'Faktura',
    ico: settings.ico,
    dic: settings.dic,
    address: settings.address,
    city: settings.city,
    postal_code: settings.postal_code,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
  }

  return buildProfessionalReportDocument(
    {
      title: 'FAKTURA – DAŇOVÝ DOKLAD',
      documentNumber: invoice.invoice_number,
      extraStyles: INVOICE_PRINT_CSS,
    },
    buildInvoiceReportHtml(invoice, settings),
    companyHeader
  )
}

export function printInvoiceReport(invoice: IssuedInvoice, settings: InvoiceSettings): void {
  openPrintDocument(buildInvoiceReportDocument(invoice, settings))
}

export function downloadInvoiceReportHtml(invoice: IssuedInvoice, settings: InvoiceSettings): void {
  downloadHtmlDocument(
    buildInvoiceReportDocument(invoice, settings),
    `faktura_${invoice.invoice_number}.html`
  )
}

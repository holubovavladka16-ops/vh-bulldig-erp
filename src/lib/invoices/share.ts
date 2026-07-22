import { formatCurrency, formatDate } from '@/constants/workers'
import type { IssuedInvoice } from '@/types/invoices'

export function buildInvoiceShareText(invoice: IssuedInvoice): string {
  return [
    `Faktura ${invoice.invoice_number} – VH Bulldig`,
    '',
    `Odběratel: ${invoice.customer_name}`,
    invoice.customer_ico ? `IČO: ${invoice.customer_ico}` : '',
    `Datum vystavení: ${formatDate(invoice.issue_date)}`,
    invoice.due_date ? `Splatnost: ${formatDate(invoice.due_date)}` : '',
    `Variabilní symbol: ${invoice.variable_symbol}`,
    `Celkem k úhradě: ${formatCurrency(invoice.total)}`,
    '',
    'PDF faktury prosím vytvořte v modulu Fakturovač ERP 8.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function getInvoiceEmailShareUrl(
  invoice: IssuedInvoice,
  recipientEmail?: string,
  subject?: string
): string {
  const to = recipientEmail?.trim() ? encodeURIComponent(recipientEmail.trim()) : ''
  const defaultSubject = `Faktura ${invoice.invoice_number} – VH Bulldig`
  return `mailto:${to}?subject=${encodeURIComponent(subject ?? defaultSubject)}&body=${encodeURIComponent(buildInvoiceShareText(invoice))}`
}

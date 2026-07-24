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
  ]
    .filter(Boolean)
    .join('\n')
}

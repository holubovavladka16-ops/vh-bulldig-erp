import { downloadCsv } from '@/lib/export'
import { formatCurrency, formatDate } from '@/constants/workers'
import { INVOICE_STATUS_LABELS, type IssuedInvoice } from '@/types/invoices'

export function exportInvoicesExcel(invoices: IssuedInvoice[], filename = 'faktury.csv'): void {
  const headers = [
    'Číslo faktury',
    'Datum',
    'Odběratel',
    'IČO',
    'Částka',
    'DPH',
    'Stav',
    'VS',
    'Zakázka',
  ]

  const rows = invoices.map((inv) => [
    inv.invoice_number,
    formatDate(inv.issue_date),
    inv.customer_name,
    inv.customer_ico,
    formatCurrency(inv.total),
    formatCurrency(inv.vat_amount),
    INVOICE_STATUS_LABELS[inv.status],
    inv.variable_symbol,
    inv.order_name ?? '',
  ])

  downloadCsv(filename, headers, rows)
}

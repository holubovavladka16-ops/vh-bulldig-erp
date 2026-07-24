import { INVOICE_STATUS_LABELS, type IssuedInvoiceStatus } from '@/types/invoices'

const STATUS_CLASSES: Record<IssuedInvoiceStatus, string> = {
  koncept: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  vytvorena: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  odeslana: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  zaplacena: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  storno: 'bg-red-500/15 text-red-300 border-red-500/30',
}

interface InvoiceStatusBadgeProps {
  status: IssuedInvoiceStatus
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {INVOICE_STATUS_LABELS[status]}
    </span>
  )
}

import { StatusBadge } from '@/components/ui/Badge'
import { INVOICEABLE_REPORT_STATUS_LABELS, type InvoiceableReportStatus } from '@/types/invoiceableWorkReports'

const VARIANT: Record<InvoiceableReportStatus, 'warning' | 'success'> = {
  rozpracovany: 'warning',
  uzavreny: 'success',
}

export function InvoiceableReportStatusBadge({ status }: { status: InvoiceableReportStatus }) {
  return <StatusBadge label={INVOICEABLE_REPORT_STATUS_LABELS[status]} variant={VARIANT[status]} />
}

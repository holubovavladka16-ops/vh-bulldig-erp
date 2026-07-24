import { buildReportDocument } from '@/lib/invoiceableWorkReports/reportDocument'
import { downloadPdfBlob, htmlToPdfBlob } from '@/lib/print/pdfDownload'
import { withPdfGeneratingOverlay } from '@/lib/print/pdfMobileUi'
import type { CompanyHeader } from '@/lib/print/printDocument'
import type { CompanySettings } from '@/types'
import type { InvoiceableWorkReportDetail } from '@/types/invoiceableWorkReports'

export async function generateReportPdfBlob(
  report: InvoiceableWorkReportDetail,
  company?: CompanyHeader | CompanySettings | null
): Promise<Blob> {
  const html = buildReportDocument(report, company)
  return withPdfGeneratingOverlay(() => htmlToPdfBlob(html))
}

export function buildReportPdfFileName(report: InvoiceableWorkReportDetail): string {
  return `fakturacni_vykaz_${report.name.replace(/\s+/g, '_')}.pdf`
}

export async function downloadReportPdf(
  report: InvoiceableWorkReportDetail,
  company?: CompanyHeader | CompanySettings | null
): Promise<void> {
  const pdfBlob = await generateReportPdfBlob(report, company)
  downloadPdfBlob(pdfBlob, buildReportPdfFileName(report))
}

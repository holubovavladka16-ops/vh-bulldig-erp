import {
  buildBulkReportsPdfBlob,
  buildDailyReportPdfBlob,
} from '@/lib/print/buildDailyReportPdf'
import { assertValidPdfBlob } from '@/lib/print/pdfShare'
import type { CompanySettings } from '@/types'
import type { ReportDetail } from '@/types/workers'

export function getReportPdfFilename(detail: ReportDetail): string {
  const safeLast = detail.worker.last_name.replace(/[^\w.-]+/g, '_')
  const date = detail.report.report_date.replace(/-/g, '')
  return `vykaz_${safeLast}_${date}.pdf`
}

export function getReportsBulkPdfFilename(workerLastName: string, count: number): string {
  const safeLast = workerLastName.replace(/[^\w.-]+/g, '_')
  return `vykazy_${safeLast}_${count}_zaznamu.pdf`
}

export async function generateReportPdfBlob(
  detail: ReportDetail,
  company: CompanySettings
): Promise<Blob> {
  const blob = await buildDailyReportPdfBlob(detail, company)
  await assertValidPdfBlob(blob)
  return blob
}

export async function generateReportsBulkPdfBlob(
  details: ReportDetail[],
  company: CompanySettings
): Promise<Blob> {
  const blob = await buildBulkReportsPdfBlob(details, company)
  await assertValidPdfBlob(blob)
  return blob
}

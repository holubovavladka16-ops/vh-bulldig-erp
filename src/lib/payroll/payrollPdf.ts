import { buildPayrollSlipPdfBlob } from '@/lib/print/buildPayrollSlipPdf'
import { assertValidPdfBlob } from '@/lib/print/pdfShare'
import type { CompanySettings } from '@/types'
import type { PayrollSlipDetail } from '@/types/payroll'

export function getPayrollSlipPdfFilename(detail: PayrollSlipDetail): string {
  const { summary, period } = detail
  const safeLast = summary.worker_last_name.replace(/[^\w.-]+/g, '_')
  return `vyplatni_paska_${safeLast}_${period.year}_${String(period.month).padStart(2, '0')}.pdf`
}

export async function generatePayrollSlipPdfBlob(
  detail: PayrollSlipDetail,
  company: CompanySettings
): Promise<Blob> {
  const blob = await buildPayrollSlipPdfBlob(detail, company)
  await assertValidPdfBlob(blob)
  return blob
}

import { formatCurrency, formatDate } from '@/constants/workers'
import type { ReportDetail } from '@/types/workers'

export function buildDailyReportShareText(detail: ReportDetail, companyName: string): string {
  const workerName = `${detail.worker.first_name} ${detail.worker.last_name}`
  return [
    `Denní výkaz – ${workerName}`,
    `Datum: ${formatDate(detail.report.report_date)}`,
    `Zakázka: ${detail.report.order_name || '—'}`,
    `Výdělek: ${formatCurrency(detail.report.earnings)}`,
    '',
    companyName,
  ].join('\n')
}

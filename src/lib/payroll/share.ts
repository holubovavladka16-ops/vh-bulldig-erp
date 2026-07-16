import { formatCurrency } from '@/constants/workers'
import type { PayrollSlipDetail } from '@/types/payroll'
import { buildPayrollSlipTitle } from '@/lib/payroll/payrollReport'

const MONTH_NAMES = [
  'leden',
  'únor',
  'březen',
  'duben',
  'květen',
  'červen',
  'červenec',
  'srpen',
  'září',
  'říjen',
  'listopad',
  'prosinec',
]

export function buildPayrollShareText(detail: PayrollSlipDetail, companyName: string): string {
  const { summary, period } = detail
  const periodLabel = `${MONTH_NAMES[period.month - 1] ?? period.month} ${period.year}`

  return [
    buildPayrollSlipTitle(detail),
    '',
    `Společnost: ${companyName}`,
    `Zaměstnanec: ${summary.worker_first_name} ${summary.worker_last_name}`,
    `Období: ${periodLabel}`,
    `Schválených výkazů: ${summary.report_count}`,
    '',
    `Celkový výdělek: ${formatCurrency(summary.total_earnings)}`,
    `Vyplacené zálohy: ${formatCurrency(summary.total_advances)}`,
    `Konečná částka k výplatě: ${formatCurrency(summary.net_amount)}`,
    '',
    'Kompletní výplatní pásku v PDF exportujte v ERP (tlačítko PDF) a přiložte ke sdílení.',
  ].join('\n')
}

export function getWhatsAppShareUrl(text: string, phone?: string | null): string {
  const encoded = encodeURIComponent(text)
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`
}

export function getEmailShareUrl(text: string, subject: string, email?: string | null): string {
  const to = email?.trim() ? encodeURIComponent(email.trim()) : ''
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}

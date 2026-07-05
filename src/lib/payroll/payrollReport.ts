import { formatCurrency, formatDate } from '@/constants/workers'
import type { CompanySettings } from '@/types'
import type { PayrollSlipDetail } from '@/types/payroll'

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

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatPeriodLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`
}

function formatPerformance(report: PayrollSlipDetail['reports'][number]): string {
  const parts: string[] = []
  if (report.hours > 0) parts.push(`${report.hours} hod`)
  if (report.meters > 0) parts.push(`${report.meters} bm`)
  if (report.pieces > 0) parts.push(`${report.pieces} ks`)
  if (report.activity?.trim()) parts.push(report.activity.trim())
  return parts.join(' · ') || '—'
}

function companyAddress(company: CompanySettings): string {
  return [company.address, company.postal_code, company.city].filter(Boolean).join(', ')
}

export function buildPayrollSlipTitle(detail: PayrollSlipDetail): string {
  const { summary, period } = detail
  return `Výplatní páska – ${summary.worker_last_name} ${summary.worker_first_name} – ${formatPeriodLabel(period.year, period.month)}`
}

export function buildPayrollSlipHtml(detail: PayrollSlipDetail, company: CompanySettings): string {
  const { summary, period, reports } = detail
  const logo = company.logo_url
    ? `<img src="${esc(company.logo_url)}" alt="Logo společnosti" class="logo" />`
    : ''

  const performanceRows = reports
    .map(
      (report) => `
        <tr>
          <td>${esc(formatDate(report.report_date))}</td>
          <td>${esc(report.order_name || '—')}</td>
          <td>${esc(formatPerformance(report))}</td>
          <td class="num">${esc(formatCurrency(report.earnings))}</td>
          <td class="num">${esc(formatCurrency(report.advance ?? 0))}</td>
        </tr>
      `
    )
    .join('')

  return `
    <div class="report">
      <header class="header">
        ${logo}
        <div>
          <h1>Výplatní páska</h1>
          <p class="company-name">${esc(company.company_name)}</p>
          ${company.tagline ? `<p class="tagline">${esc(company.tagline)}</p>` : ''}
        </div>
      </header>

      <table class="company-table">
        ${company.ico ? `<tr><th>IČO</th><td>${esc(company.ico)}</td></tr>` : ''}
        ${company.dic ? `<tr><th>DIČ</th><td>${esc(company.dic)}</td></tr>` : ''}
        ${companyAddress(company) ? `<tr><th>Adresa</th><td>${esc(companyAddress(company))}</td></tr>` : ''}
        ${company.phone ? `<tr><th>Telefon</th><td>${esc(company.phone)}</td></tr>` : ''}
        ${company.email ? `<tr><th>E-mail</th><td>${esc(company.email)}</td></tr>` : ''}
        ${company.bank_account ? `<tr><th>Bankovní účet</th><td>${esc(company.bank_account)}</td></tr>` : ''}
      </table>

      <table class="meta-table">
        <tr><th>Zaměstnanec</th><td>${esc(summary.worker_first_name)} ${esc(summary.worker_last_name)}</td></tr>
        <tr><th>Období</th><td>${esc(formatPeriodLabel(period.year, period.month))}</td></tr>
        <tr><th>Počet schválených výkazů</th><td>${esc(summary.report_count)}</td></tr>
      </table>

      <h2>Přehled odpracovaných výkonů</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Zakázka</th>
            <th>Výkon</th>
            <th>Výdělek</th>
            <th>Záloha</th>
          </tr>
        </thead>
        <tbody>
          ${performanceRows}
        </tbody>
      </table>

      <table class="totals-table">
        <tr><th>Celkový výdělek</th><td class="num">${esc(formatCurrency(summary.total_earnings))}</td></tr>
        <tr><th>Vyplacené zálohy</th><td class="num">${esc(formatCurrency(summary.total_advances))}</td></tr>
        <tr class="net-row"><th>Konečná částka k výplatě</th><td class="num">${esc(formatCurrency(summary.net_amount))}</td></tr>
      </table>

      <p class="footer">Vygenerováno z ERP VH Bulldig · ${esc(formatDate(new Date().toISOString().slice(0, 10)))}</p>
    </div>
  `
}

export function buildPayrollSlipDocument(detail: PayrollSlipDetail, company: CompanySettings): string {
  const body = buildPayrollSlipHtml(detail, company)
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <title>${esc(buildPayrollSlipTitle(detail))}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, sans-serif; color: #111; margin: 0; }
    .report { max-width: 180mm; margin: 0 auto; }
    .header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
    .logo { max-height: 64px; max-width: 160px; object-fit: contain; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 20px 0 8px; }
    .company-name { font-size: 15px; font-weight: bold; margin: 0; }
    .tagline { font-size: 12px; color: #666; margin: 2px 0 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
    th { background: #f5f5f5; }
    .company-table th { width: 28%; }
    .meta-table th { width: 34%; }
    .data-table th, .data-table td { font-size: 11px; }
    .totals-table { margin-top: 16px; max-width: 360px; margin-left: auto; }
    .totals-table th { width: 58%; }
    .net-row th, .net-row td { font-weight: bold; font-size: 13px; background: #f0f7ff; }
    .num { text-align: right; white-space: nowrap; }
    .footer { margin-top: 24px; font-size: 11px; color: #666; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>${body}</body>
</html>`
}

export function openPayrollSlipReport(detail: PayrollSlipDetail, company: CompanySettings): void {
  const html = buildPayrollSlipDocument(detail, company)
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

export function printPayrollSlipReport(detail: PayrollSlipDetail, company: CompanySettings): void {
  const html = buildPayrollSlipDocument(detail, company)
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

export function downloadPayrollSlipReport(detail: PayrollSlipDetail, company: CompanySettings): void {
  const html = buildPayrollSlipDocument(detail, company)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `vyplatni_paska_${detail.summary.worker_last_name}_${detail.period.year}_${String(detail.period.month).padStart(2, '0')}.html`
  link.click()
  URL.revokeObjectURL(url)
}

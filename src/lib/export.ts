import {
  buildProfessionalReportDocument,
  escHtml,
  openPrintDocument,
  type CompanyHeader,
  type ProfessionalReportOptions,
} from '@/lib/print/printDocument'
import type { CompanySettings } from '@/types'

/** Export CSV kompatibilní s Excel (ČR) */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(';'), ...rows.map((row) => row.map(escape).join(';'))]
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function printProfessionalReport(
  title: string,
  bodyHtml: string,
  company?: CompanyHeader | CompanySettings | null,
  options?: Partial<ProfessionalReportOptions>
): void {
  const html = buildProfessionalReportDocument({ title, ...options }, bodyHtml, company)
  openPrintDocument(html)
}

/** @deprecated Používejte printProfessionalReport */
export function printHtml(title: string, bodyHtml: string, company?: CompanyHeader | null): void {
  printProfessionalReport(title, bodyHtml, company)
}

export function buildPrintBodyHtml(
  title: string,
  bodyHtml: string,
  company?: CompanyHeader | CompanySettings | null,
  options?: Partial<ProfessionalReportOptions>
): string {
  return buildProfessionalReportDocument({ title, ...options }, bodyHtml, company)
}

export { escHtml as escPrintHtml }

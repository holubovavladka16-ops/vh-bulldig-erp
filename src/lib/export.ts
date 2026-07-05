import { buildPrintDocument, escHtml, openPrintDocument } from '@/lib/print/printDocument'

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

export function printHtml(title: string, bodyHtml: string): void {
  const html = buildPrintDocument(title, `<div class="report">${bodyHtml}</div>`)
  openPrintDocument(html)
}

export function buildPrintBodyHtml(title: string, bodyHtml: string): string {
  return buildPrintDocument(title, `<div class="report">${bodyHtml}</div>`)
}

export { escHtml as escPrintHtml }

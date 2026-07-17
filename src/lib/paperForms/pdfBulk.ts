import { jsPDF } from 'jspdf'
import { ensurePdfFonts } from '@/lib/print/pdfFont'
import { assertValidPdfBlob } from '@/lib/print/pdfShare'
import { drawPaperMonthlyFormPage } from '@/lib/paperForms/pdf'
import type { CompanySettings } from '@/types'
import type { PaperFormLine, PaperMonthlyForm } from '@/types/paperForms'

export interface BulkPaperFormPdfItem {
  form: PaperMonthlyForm
  lines: PaperFormLine[]
}

export async function buildBulkBlankPaperFormsPdfBlob(
  items: BulkPaperFormPdfItem[],
  company: CompanySettings
): Promise<Blob> {
  if (items.length === 0) {
    throw new Error('Žádné formuláře k tisku')
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  await ensurePdfFonts(doc)

  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      doc.addPage()
    }
    await drawPaperMonthlyFormPage(doc, items[i]!.form, items[i]!.lines, company)
  }

  const blob = doc.output('blob')
  assertValidPdfBlob(blob)
  return blob
}

export function getBulkBlankPaperFormsPdfFilename(month: number, year: number, count: number): string {
  const period = `${year}-${String(month).padStart(2, '0')}`
  return `prazdne_formulare_${period}_${count}ks.pdf`
}

import {
  buildDefaultPdfFileName,
  downloadPdfBlob,
  extractDocumentTitle,
  htmlToPdfBlob,
} from '@/lib/print/pdfDownload'
import { openPdfPreview, withPdfGeneratingOverlay } from '@/lib/print/pdfMobileUi'

export interface ProfessionalPdfOptions {
  fileName?: string
  title?: string
  shareText?: string
}

/** Náhled i Tisk/PDF – vždy in-app pdf.js modal (stejně jako Stavební deník → printDiaryReport). */
async function openProfessionalPdfInApp(html: string, options?: ProfessionalPdfOptions): Promise<void> {
  try {
    const pdfBlob = await withPdfGeneratingOverlay(() => htmlToPdfBlob(html))
    const title = options?.title ?? extractDocumentTitle(html)
    const fileName = options?.fileName ?? buildDefaultPdfFileName(html)
    openPdfPreview(pdfBlob, fileName, {
      title,
      shareText: options?.shareText,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generování PDF se nezdařilo.'
    window.alert(message)
  }
}

export function previewProfessionalPdf(html: string, options?: ProfessionalPdfOptions): void {
  void openProfessionalPdfInApp(html, options)
}

export function printProfessionalPdf(html: string, options?: ProfessionalPdfOptions): void {
  void openProfessionalPdfInApp(html, options)
}

export async function downloadProfessionalPdf(html: string, fileName: string): Promise<void> {
  const pdfBlob = await withPdfGeneratingOverlay(() => htmlToPdfBlob(html))
  downloadPdfBlob(pdfBlob, fileName)
}

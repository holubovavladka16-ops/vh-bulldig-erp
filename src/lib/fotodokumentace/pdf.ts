import { withPdfGeneratingOverlay } from '@/lib/print/pdfMobileUi'
import { sanitizePdfFileName } from '@/lib/print/pdfDownload'
import {
  buildFotoReportBulkPdfBlob,
  buildFotoReportPdfBlob,
  getFotoReportPdfFileName,
} from '@/lib/fotodokumentace/fotoReportPdf'
import type { FotoDokument } from '@/types/fotodokumentace'
import type { CompanySettings } from '@/types'

export {
  buildFotoReportPrintDocument,
  buildFotoReportBulkPrintDocument,
  buildFotoReportPdfBlob,
  buildFotoReportBulkPdfBlob,
  createFotoReportPdfFile,
  downloadFotoReportPdf,
  getFotoReportPdfFileName,
  openFotoReportPdfPreview,
  printFotoReport,
} from '@/lib/fotodokumentace/fotoReportPdf'

/** GPS fotodoklad ERP 7 – 1 fotografie = 1 pevná A4 stránka. */
export async function vytvoritFotodokumentPdf(
  fotografie: FotoDokument[],
  company: CompanySettings | null
): Promise<Blob> {
  if (fotografie.length === 0) {
    throw new Error('Nejsou vybrány žádné fotografie.')
  }

  const approved = fotografie.filter((f) => f.approval_status === 'schvalena' || fotografie.length === 1)
  const toRender = approved.length > 0 ? approved : fotografie

  return buildFotoReportBulkPdfBlob(toRender, company)
}

export async function vytvoritPredPoPdf(
  pred: FotoDokument,
  po: FotoDokument,
  company: CompanySettings | null
): Promise<Blob> {
  return vytvoritFotodokumentPdf([pred, po], company)
}

export function getFotodokumentPdfFileName(foto: FotoDokument): string {
  return getFotoReportPdfFileName(foto)
}

export function getBulkFotodokumentPdfFileName(count: number): string {
  return sanitizePdfFileName(`fotodokumentace_${count}_fotek.pdf`)
}

export async function stahnoutFotodokumentPdf(
  foto: FotoDokument,
  company: CompanySettings | null
): Promise<void> {
  await withPdfGeneratingOverlay(async () => {
    const blob = await buildFotoReportPdfBlob(foto, company)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = getFotoReportPdfFileName(foto)
    a.click()
    URL.revokeObjectURL(a.href)
  })
}

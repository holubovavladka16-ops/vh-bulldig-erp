import { buildInvoiceReportDocument } from '@/lib/invoices/invoiceReport'
import { buildInvoiceShareText } from '@/lib/invoices/share'
import {
  downloadPdfBlob,
  htmlToPdfBlob,
  pdfBlobToFile,
  sharePdfFile,
  type SharePdfResult,
} from '@/lib/print/pdfDownload'
import { withPdfGeneratingOverlay } from '@/lib/print/pdfMobileUi'
import type { InvoiceSettings, IssuedInvoice } from '@/types/invoices'

export async function generateInvoicePdfBlob(
  invoice: IssuedInvoice,
  settings: InvoiceSettings
): Promise<Blob> {
  const html = buildInvoiceReportDocument(invoice, settings)
  return withPdfGeneratingOverlay(() => htmlToPdfBlob(html))
}

export function buildInvoicePdfFileName(invoice: IssuedInvoice): string {
  return `faktura_${invoice.invoice_number}.pdf`
}

export async function downloadInvoicePdf(invoice: IssuedInvoice, settings: InvoiceSettings): Promise<void> {
  const pdfBlob = await generateInvoicePdfBlob(invoice, settings)
  downloadPdfBlob(pdfBlob, buildInvoicePdfFileName(invoice))
}

export type ShareInvoicePdfResult = SharePdfResult | 'downloaded'

export async function shareInvoicePdf(
  invoice: IssuedInvoice,
  settings: InvoiceSettings
): Promise<ShareInvoicePdfResult> {
  const pdfBlob = await generateInvoicePdfBlob(invoice, settings)
  const fileName = buildInvoicePdfFileName(invoice)
  const shareText = buildInvoiceShareText(invoice)

  if (typeof navigator.share === 'function') {
    const pdfFile = pdfBlobToFile(pdfBlob, fileName)
    const shareData: ShareData = {
      title: `Faktura ${invoice.invoice_number}`,
      text: shareText,
    }

    if (navigator.canShare?.({ files: [pdfFile], ...shareData })) {
      try {
        await navigator.share({ ...shareData, files: [pdfFile] })
        return 'shared'
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      }
    }

    try {
      await navigator.share(shareData)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  const fileShare = await sharePdfFile(pdfBlob, fileName)
  if (fileShare === 'shared' || fileShare === 'cancelled') return fileShare

  downloadPdfBlob(pdfBlob, fileName)
  return 'downloaded'
}

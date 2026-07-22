import { supabase } from '@/lib/supabase'
import { buildInvoiceReportDocument } from '@/lib/invoices/invoiceReport'
import { buildInvoiceShareText } from '@/lib/invoices/share'
import { htmlToPdfBlob, pdfBlobToFile, sharePdfFile } from '@/lib/print/pdfDownload'
import { withPdfGeneratingOverlay } from '@/lib/print/pdfMobileUi'
import type { InvoiceSettings, IssuedInvoice } from '@/types/invoices'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Nepodařilo se převést PDF'))
        return
      }
      const base64 = result.split(',')[1]
      if (!base64) {
        reject(new Error('Nepodařilo se převést PDF'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Nepodařilo se převést PDF'))
    reader.readAsDataURL(blob)
  })
}

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

export interface SendInvoiceEmailResult {
  method: 'resend' | 'share' | 'cancelled'
  sentTo?: string
}

export async function sendInvoiceEmail(
  invoice: IssuedInvoice,
  settings: InvoiceSettings,
  recipientEmail: string
): Promise<SendInvoiceEmailResult> {
  const to = recipientEmail.trim()
  if (!to) throw new Error('Vyplňte e-mail odběratele')

  const pdfBlob = await generateInvoicePdfBlob(invoice, settings)
  const fileName = buildInvoicePdfFileName(invoice)

  try {
    const pdfBase64 = await blobToBase64(pdfBlob)
    const { data, error } = await supabase.functions.invoke('send-invoice-email', {
      body: {
        invoice_id: invoice.id,
        to_email: to,
        subject: `Faktura ${invoice.invoice_number} – VH Bulldig s.r.o.`,
        message: buildInvoiceShareText(invoice).replace(/\n/g, '<br/>'),
        pdf_base64: pdfBase64,
        pdf_filename: fileName,
      },
    })

    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(String(data.error))

    return { method: 'resend', sentTo: to }
  } catch (serverError) {
    const shareResult = await sharePdfFile(pdfBlob, fileName)
    if (shareResult === 'shared') {
      return { method: 'share', sentTo: to }
    }
    if (shareResult === 'cancelled') {
      return { method: 'cancelled' }
    }

    const message = serverError instanceof Error ? serverError.message : 'Odeslání selhalo'
    throw new Error(
      `${message}. Zkuste PDF sdílet ručně – soubor ${fileName} byl připraven k odeslání.`
    )
  }
}

export async function downloadInvoicePdf(invoice: IssuedInvoice, settings: InvoiceSettings): Promise<void> {
  const pdfBlob = await generateInvoicePdfBlob(invoice, settings)
  const file = pdfBlobToFile(pdfBlob, buildInvoicePdfFileName(invoice))
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
}

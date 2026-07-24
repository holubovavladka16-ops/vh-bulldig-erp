import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { PdfPreviewModal } from '@/components/print/PdfPreviewModal'

export interface PdfPreviewOptions {
  title?: string
  shareText?: string
}

/** Otevře náhled PDF v aplikaci. Nikdy nespouští automatické stažení ani systémový tisk. */
export function openPdfPreview(pdfBlob: Blob, fileName: string, options?: PdfPreviewOptions): void {
  document.getElementById('vh-pdf-preview')?.remove()

  const host = document.createElement('div')
  host.id = 'vh-pdf-preview'
  host.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:auto;'
  document.body.appendChild(host)

  const root = createRoot(host)
  const close = () => {
    root.unmount()
    host.remove()
  }

  root.render(
    createElement(PdfPreviewModal, {
      pdfBlob,
      fileName,
      title: options?.title ?? fileName.replace(/\.pdf$/i, ''),
      shareText: options?.shareText,
      onClose: close,
    })
  )
}

export async function withPdfGeneratingOverlay<T>(fn: () => Promise<T>): Promise<T> {
  const overlay = document.createElement('div')
  overlay.setAttribute('role', 'status')
  overlay.setAttribute('aria-live', 'polite')
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.72);color:#fff;font:500 15px/1.4 system-ui,sans-serif;'
  overlay.textContent = 'Připravuji PDF soubor…'
  document.body.appendChild(overlay)

  try {
    return await fn()
  } finally {
    overlay.remove()
  }
}

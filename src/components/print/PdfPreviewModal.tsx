import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Printer, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { downloadPdfBlob, printPdfBlob, sharePdfFile, type SharePdfResult } from '@/lib/print/pdfDownload'
import { renderPdfBlobPreview } from '@/lib/print/pdfPreviewRender'

export interface PdfPreviewModalProps {
  pdfBlob: Blob
  fileName: string
  title: string
  shareText?: string
  onClose: () => void
}

export function PdfPreviewModal({ pdfBlob, fileName, title, shareText, onClose }: PdfPreviewModalProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [shareStatus, setShareStatus] = useState<SharePdfResult | null>(null)
  const [busy, setBusy] = useState<'download' | 'share' | 'print' | null>(null)

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.touchAction = prevTouchAction
    }
  }, [])

  useEffect(() => {
    const container = previewRef.current
    if (!container) return

    let cancelled = false
    const run = async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      if (cancelled) return
      await renderPdfBlobPreview(container, pdfBlob)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [pdfBlob])

  function handleDownload() {
    setBusy('download')
    try {
      downloadPdfBlob(pdfBlob, fileName)
    } finally {
      setBusy(null)
    }
  }

  function handlePrint() {
    setBusy('print')
    try {
      printPdfBlob(pdfBlob)
    } finally {
      setBusy(null)
    }
  }

  async function handleShare() {
    setBusy('share')
    try {
      const result = await sharePdfFile(pdfBlob, fileName, title, shareText)
      setShareStatus(result)
    } finally {
      setBusy(null)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex flex-col bg-[var(--bg-elevated)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-preview-title"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <header className="sticky top-0 z-20 shrink-0 border-b border-[var(--border-glass)] bg-[var(--bg-elevated)] px-3 py-3 shadow-sm sm:px-4">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="pdf-preview-title" className="text-base font-semibold text-theme-primary sm:text-lg">
                Náhled PDF
              </h2>
              <p className="truncate text-xs text-theme-muted sm:text-sm">{title}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-theme-muted hover:bg-white/5"
              aria-label="Zavřít náhled"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button type="button" variant="secondary" className="min-h-[44px] w-full" onClick={onClose}>
              <X className="h-4 w-4" />
              Zavřít náhled
            </Button>
            <Button
              type="button"
              className="min-h-[44px] w-full"
              loading={busy === 'download'}
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              Stáhnout PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px] w-full"
              loading={busy === 'share'}
              onClick={() => void handleShare()}
            >
              <Share2 className="h-4 w-4" />
              Sdílet PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px] w-full"
              loading={busy === 'print'}
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" />
              Tisk PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-4">
        <div ref={previewRef} className="mx-auto w-full max-w-4xl space-y-3" />
      </div>

      <footer className="shrink-0 border-t border-[var(--border-glass)] bg-[var(--bg-elevated)] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="mx-auto w-full max-w-4xl">
          {shareStatus === 'unsupported' && (
            <p className="text-xs text-amber-300 sm:text-sm">
              Sdílení souboru není v tomto zařízení podporováno. Nejprve PDF stáhněte.
            </p>
          )}
          {shareStatus === 'shared' && (
            <p className="text-xs text-green-400 sm:text-sm">PDF bylo odesláno přes systémové sdílení.</p>
          )}
          {shareStatus === 'cancelled' && (
            <p className="text-xs text-theme-muted sm:text-sm">Sdílení bylo zrušeno.</p>
          )}
        </div>
      </footer>
    </div>,
    document.body
  )
}

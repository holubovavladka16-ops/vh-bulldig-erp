import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Download, Share2, Printer, FileText, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  downloadPdfBlobMobile,
  ensurePdfBlob,
  openPdfBlobInNewTab,
  printPdfBlob,
  sharePdfBlob,
} from '@/lib/print/pdfShare'
import { isMobilePdfDevice } from '@/lib/print/mobileDetect'

interface MobilePdfPreviewModalProps {
  title: string
  fileName: string
  onGenerate: () => Promise<Blob>
  onClose: () => void
}

export function MobilePdfPreviewModal({
  title,
  fileName,
  onGenerate,
  onClose,
}: MobilePdfPreviewModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const blobRef = useRef<Blob | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const generateRef = useRef(onGenerate)
  generateRef.current = onGenerate
  const mobile = isMobilePdfDevice()

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

  const handleClose = useCallback(() => {
    revokePreviewUrl()
    setPreviewUrl(null)
    blobRef.current = null
    onClose()
  }, [onClose, revokePreviewUrl])

  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      setLoading(true)
      setError('')
      setStatus('')
      revokePreviewUrl()
      setPreviewUrl(null)
      blobRef.current = null

      try {
        const blob = ensurePdfBlob(await generateRef.current())
        if (cancelled) return
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        previewUrlRef.current = url
        setPreviewUrl(url)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Generování PDF se nezdařilo.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadPdf()

    return () => {
      cancelled = true
      revokePreviewUrl()
    }
  }, [fileName, title, revokePreviewUrl])

  async function handleDownload() {
    if (!blobRef.current || actionBusy) return
    setActionBusy(true)
    setStatus('')
    setError('')
    try {
      const result = await downloadPdfBlobMobile(blobRef.current, fileName)
      if (result === 'shared') setStatus('PDF bylo sdíleno / uloženo.')
      else if (result === 'opened') setStatus('PDF bylo otevřeno v prohlížeči – uložte přes menu.')
      else setStatus('PDF bylo staženo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stažení PDF se nezdařilo.')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleShare() {
    if (!blobRef.current || actionBusy) return
    setActionBusy(true)
    setStatus('')
    setError('')
    try {
      const result = await sharePdfBlob(blobRef.current, fileName, title)
      if (result === 'shared') setStatus('PDF bylo sdíleno.')
      else if (result === 'downloaded') {
        setStatus('Sdílení není podporováno – PDF bylo otevřeno nebo staženo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sdílení PDF se nezdařilo.')
    } finally {
      setActionBusy(false)
    }
  }

  async function handlePrint() {
    if (!blobRef.current || actionBusy) return
    setActionBusy(true)
    setStatus('')
    setError('')
    try {
      const ok = await printPdfBlob(blobRef.current, fileName)
      setStatus(
        ok
          ? mobile
            ? 'PDF otevřeno pro tisk nebo uložení.'
            : 'Dialog tisku byl otevřen.'
          : 'Tisk PDF se nezdařil – zkuste stažení nebo sdílení.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tisk PDF se nezdařil.')
    } finally {
      setActionBusy(false)
    }
  }

  function handleOpenExternal() {
    if (!blobRef.current) return
    const ok = openPdfBlobInNewTab(blobRef.current)
    setStatus(ok ? 'PDF otevřeno v externím prohlížeči.' : 'Otevření PDF bylo zablokováno.')
  }

  const modal = (
    <div className="mobile-pdf-preview">
      <div className="mobile-pdf-preview__backdrop" onClick={handleClose} aria-hidden="true" />
      <div className="mobile-pdf-preview__panel glass-panel neon-border">
        <div className="mobile-pdf-preview__header">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
            <h2 className="truncate text-base font-bold text-theme-primary">{title}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="touch-target rounded-lg p-2 hover:bg-white/5"
            aria-label="Zavřít"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mobile-pdf-preview__body">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
              <p className="text-sm text-theme-secondary">Generuji PDF…</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <Button type="button" className="mt-4" variant="secondary" onClick={handleClose}>
                Zavřít
              </Button>
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              title={title}
              className="mobile-pdf-preview__embed"
            />
          ) : null}
        </div>

        {!loading && !error && previewUrl && (
          <div className="mobile-pdf-preview__actions">
            <Button type="button" variant="secondary" className="min-h-[44px] flex-1" onClick={handleClose}>
              Zavřít
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px] flex-1"
              disabled={actionBusy}
              onClick={() => void handleDownload()}
            >
              <Download className="h-4 w-4" />
              Stáhnout PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px] flex-1"
              disabled={actionBusy}
              onClick={() => void handleShare()}
            >
              <Share2 className="h-4 w-4" />
              Sdílet PDF
            </Button>
            <Button
              type="button"
              className="min-h-[44px] flex-1"
              disabled={actionBusy}
              onClick={() => void handlePrint()}
            >
              <Printer className="h-4 w-4" />
              {mobile ? 'Tisk / Uložit' : 'Tisk PDF'}
            </Button>
            {mobile && (
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px] col-span-2"
                onClick={handleOpenExternal}
              >
                <ExternalLink className="h-4 w-4" />
                Otevřít PDF v prohlížeči
              </Button>
            )}
          </div>
        )}

        {status && <p className="mobile-pdf-preview__status text-sm text-green-400">{status}</p>}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

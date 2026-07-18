import { FileDown, Printer, Share2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import {
  buildPhotoShareText,
  isWebShareAvailable,
  shareGpsPhoto,
  shareGpsPhotoFallbackDownload,
} from '@/lib/photos/share'
import { downloadGpsPhoto, logGpsPhotoShare } from '@/lib/photos/api'
import { downloadPhotoReportHtml, printPhotoReport } from '@/lib/photos/photoReport'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { GpsPhoto } from '@/types/photos'
import { useState } from 'react'

interface PhotoShareButtonsProps {
  photo: GpsPhoto
  userId: string
  note: string
  onShared?: () => void
}

export function PhotoShareButtons({ photo, userId, note, onShared }: PhotoShareButtonsProps) {
  const { settings: company } = useCompanySettings()
  const sharePhoto = { ...photo, note: note || photo.note }
  const [sharing, setSharing] = useState(false)
  const [showFallback, setShowFallback] = useState(!isWebShareAvailable())
  const [message, setMessage] = useState<string | null>(null)

  async function logShare(channel: string) {
    await logGpsPhotoShare(photo.id, channel, userId)
    onShared?.()
  }

  function handlePrintPdf() {
    printPhotoReport(sharePhoto, company)
    void logShare('pdf_tisk')
  }

  function handleExportPdf() {
    downloadPhotoReportHtml(sharePhoto, company)
    void logShare('pdf_ulozeni')
  }

  async function handleSharePhoto() {
    setSharing(true)
    setMessage(null)
    try {
      const result = await shareGpsPhoto(sharePhoto)
      if (result === 'shared' || result === 'shared_file_only') {
        await logShare('native_file_share')
        if (result === 'shared_file_only') {
          setMessage('Fotografie sdílena. Popis zkopírován do schránky.')
        }
        return
      }
      if (result === 'shared_text_only') {
        await logShare('native_text_share')
        setShowFallback(true)
        return
      }
      if (result === 'unsupported') setShowFallback(true)
    } catch {
      setShowFallback(true)
    } finally {
      setSharing(false)
    }
  }

  async function handleFallbackDownload() {
    setSharing(true)
    try {
      const result = await shareGpsPhotoFallbackDownload(sharePhoto, downloadGpsPhoto)
      if (result === 'downloaded') await logShare('stazeni_fotky')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => void handleSharePhoto()} loading={sharing}>
        <Share2 className="h-4 w-4" />
        Sdílet fotku s informacemi
      </Button>

      <pre className="whitespace-pre-wrap rounded-lg border border-[var(--border-glass)] bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-theme-secondary">
        {buildPhotoShareText(sharePhoto)}
      </pre>

      {message && <p className="text-xs text-amber-200">{message}</p>}

      {showFallback && (
        <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3">
          <p className="text-xs text-theme-muted">Záložní varianty sdílení:</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:flex-1"
              onClick={() => void (isWebShareAvailable() ? handleSharePhoto() : handleFallbackDownload())}
              loading={sharing}
            >
              <Share2 className="h-4 w-4" />
              Sdílet fotku s informacemi
            </Button>
            <Button variant="secondary" size="sm" className="w-full sm:flex-1" onClick={handleExportPdf}>
              <FileDown className="h-4 w-4" />
              Export do PDF
            </Button>
          </div>
        </div>
      )}

      <Button variant="secondary" size="sm" onClick={handlePrintPdf} className="w-full sm:w-auto">
        <Printer className="h-4 w-4" />
        PDF – tisk
      </Button>
    </div>
  )
}

interface PhotoNoteEditorProps {
  note: string
  onChange: (value: string) => void
  onSave: () => void
  saving: boolean
}

export function PhotoNoteEditor({ note, onChange, onSave, saving }: PhotoNoteEditorProps) {
  return (
    <div className="space-y-3">
      <Textarea label="Poznámka" value={note} onChange={(e) => onChange(e.target.value)} />
      <Button size="sm" onClick={onSave} loading={saving}>Uložit poznámku</Button>
    </div>
  )
}

export function PhotoDeleteButton({ onDelete, loading }: { onDelete: () => void; loading: boolean }) {
  return (
    <Button variant="danger" size="sm" onClick={onDelete} loading={loading}>
      <Trash2 className="h-4 w-4" />
      Smazat fotografii
    </Button>
  )
}

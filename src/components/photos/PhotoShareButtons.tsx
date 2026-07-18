import { Copy, Download, FileDown, Printer, Share2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { copyPhotoShareText, isWebShareAvailable, shareGpsPhoto } from '@/lib/photos/share'
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

  async function logShare(channel: string) {
    await logGpsPhotoShare(photo.id, channel, userId)
    onShared?.()
  }

  function handlePrintPdf() {
    printPhotoReport(sharePhoto, company)
    void logShare('pdf_tisk')
  }

  function handleDownloadPdf() {
    downloadPhotoReportHtml(sharePhoto, company)
    void logShare('pdf_ulozeni')
  }

  async function handleSharePhoto() {
    setSharing(true)
    try {
      const result = await shareGpsPhoto(sharePhoto)
      if (result === 'shared') await logShare('native_file_share')
      else if (result === 'shared_text_only') await logShare('native_text_share')
      else if (result === 'unsupported') setShowFallback(true)
    } catch {
      setShowFallback(true)
    } finally {
      setSharing(false)
    }
  }

  async function handleDownloadPhoto() {
    try {
      await downloadGpsPhoto(photo.file_path, photo.file_name)
      await logShare('stazeni_fotky')
    } catch {
      // ignore
    }
  }

  async function handleCopyText() {
    try {
      await copyPhotoShareText(sharePhoto)
      await logShare('clipboard')
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => void handleSharePhoto()} loading={sharing}>
        <Share2 className="h-4 w-4" />
        Sdílet fotografii
      </Button>

      {showFallback && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => void handleDownloadPhoto()} className="w-full sm:w-auto">
            <Download className="h-4 w-4" />
            Stáhnout fotku
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadPdf} className="w-full sm:w-auto">
            <FileDown className="h-4 w-4" />
            PDF – uložit
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void handleCopyText()} className="w-full sm:w-auto">
            <Copy className="h-4 w-4" />
            Kopírovat popis
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" size="sm" onClick={handlePrintPdf} className="w-full sm:w-auto">
          <Printer className="h-4 w-4" />
          PDF – tisk
        </Button>
      </div>
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

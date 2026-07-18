import { FileDown, Printer, Share2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { PhotoShareSheet } from '@/components/photos/PhotoShareSheet'
import type { PhotoShareMode } from '@/lib/photos/share'
import { logGpsPhotoShare } from '@/lib/photos/api'
import { downloadPhotoReportHtml, printPhotoReport } from '@/lib/photos/photoReport'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { GpsPhoto } from '@/types/photos'

interface PhotoShareButtonsProps {
  photo: GpsPhoto
  userId: string
  note: string
  onShared?: () => void
}

export function PhotoShareButtons({ photo, userId, note, onShared }: PhotoShareButtonsProps) {
  const { settings: company } = useCompanySettings()
  const sharePhoto = { ...photo, note: note || photo.note }
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [shareMode, setShareMode] = useState<PhotoShareMode>('document')

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

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => setShareSheetOpen(true)}>
        <Share2 className="h-4 w-4" />
        Sdílet fotku s informacemi
      </Button>

      <PhotoShareSheet
        open={shareSheetOpen}
        photo={sharePhoto}
        shareMode={shareMode}
        onShareModeChange={setShareMode}
        onClose={() => setShareSheetOpen(false)}
        onShared={(channel) => void logShare(channel)}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" size="sm" onClick={handlePrintPdf} className="w-full sm:w-auto">
          <Printer className="h-4 w-4" />
          PDF – tisk
        </Button>
        <Button variant="secondary" size="sm" onClick={handleDownloadPdf} className="w-full sm:w-auto">
          <FileDown className="h-4 w-4" />
          PDF – uložit
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

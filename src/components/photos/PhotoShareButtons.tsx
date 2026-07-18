import { FileDown, Printer, Share2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { logGpsPhotoShare } from '@/lib/photos/api'
import {
  downloadPhotoReportPdf,
  printPhotoReport,
  sharePhotoReportPdf,
} from '@/lib/photos/photoReport'
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
  const [sharingPdf, setSharingPdf] = useState(false)

  async function logShare(channel: string) {
    await logGpsPhotoShare(photo.id, channel, userId)
    onShared?.()
  }

  async function handleSharePdf() {
    setSharingPdf(true)
    try {
      const result = await sharePhotoReportPdf(sharePhoto, company)
      if (result === 'shared') await logShare('pdf_sdileni')
      else if (result === 'downloaded') await logShare('pdf_sdileni_fallback')
    } finally {
      setSharingPdf(false)
    }
  }

  function handlePrintPdf() {
    printPhotoReport(sharePhoto, company)
    void logShare('pdf_tisk')
  }

  async function handleSavePdf() {
    await downloadPhotoReportPdf(sharePhoto, company)
    await logShare('pdf_ulozeni')
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => void handleSharePdf()} loading={sharingPdf}>
        <Share2 className="h-4 w-4" />
        Sdílet GPS fotodoklad
      </Button>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" size="sm" onClick={() => void handleSavePdf()} className="w-full sm:w-auto">
          <FileDown className="h-4 w-4" />
          Uložit PDF doklad
        </Button>
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

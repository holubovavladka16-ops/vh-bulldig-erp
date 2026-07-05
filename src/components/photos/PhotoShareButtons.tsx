import { Mail, MessageCircle, Printer, Send, FileDown, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import {
  buildPhotoShareText,
  getEmailShareUrl,
  getMessengerShareUrl,
  getWhatsAppShareUrl,
} from '@/lib/photos/share'
import { getGoogleMapsUrl } from '@/lib/photos/mapLinks'
import { downloadGpsPhoto, logGpsPhotoShare } from '@/lib/photos/api'
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
  const text = `${buildPhotoShareText(sharePhoto)}\n\nPDF report vytvořte v ERP tlačítkem „PDF – tisk“ nebo „PDF – uložit“.`
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)

  async function logShare(channel: string) {
    await logGpsPhotoShare(photo.id, channel, userId)
    onShared?.()
  }

  function handlePrintPdf() {
    printPhotoReport(sharePhoto, company)
    logShare('pdf_tisk')
  }

  function handleDownloadPdf() {
    downloadPhotoReportHtml(sharePhoto, company)
    logShare('pdf_ulozeni')
  }

  async function handleDownloadPhoto() {
    try {
      await downloadGpsPhoto(photo.file_path, photo.file_name)
      await logShare('stazeni_fotky')
    } catch {
      // ignore – browser may block programmatic download
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" size="sm" onClick={handleDownloadPhoto} className="w-full sm:w-auto">
          <Download className="h-4 w-4" />
          Stáhnout fotku
        </Button>
        <Button variant="secondary" size="sm" onClick={handlePrintPdf} className="w-full sm:w-auto">
          <Printer className="h-4 w-4" />
          PDF – tisk
        </Button>
        <Button variant="secondary" size="sm" onClick={handleDownloadPdf} className="w-full sm:w-auto">
          <FileDown className="h-4 w-4" />
          PDF – uložit
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a href={getWhatsAppShareUrl(text)} target="_blank" rel="noopener noreferrer" onClick={() => logShare('whatsapp')} className="w-full sm:w-auto">
          <Button variant="secondary" size="sm" type="button" className="w-full sm:w-auto">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </a>
        <a href={getMessengerShareUrl(text, mapUrl)} target="_blank" rel="noopener noreferrer" onClick={() => logShare('messenger')} className="w-full sm:w-auto">
          <Button variant="secondary" size="sm" type="button" className="w-full sm:w-auto">
            <Send className="h-4 w-4" />
            Messenger
          </Button>
        </a>
        <a href={getEmailShareUrl(text)} onClick={() => logShare('email')} className="w-full sm:w-auto">
          <Button variant="secondary" size="sm" type="button" className="w-full sm:w-auto">
            <Mail className="h-4 w-4" />
            E-mail
          </Button>
        </a>
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

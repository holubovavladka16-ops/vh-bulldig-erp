import { Mail, MessageCircle, Printer, Send, FileDown, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { downloadGpsPhoto, logGpsPhotoShare } from '@/lib/photos/api'
import { downloadPhotoReportHtml, printPhotoReport } from '@/lib/photos/photoReport'
import { shareGpsPhoto } from '@/lib/photos/sharePayload'
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

  async function logShare(channel: string) {
    await logGpsPhotoShare(photo.id, channel, userId)
    onShared?.()
  }

  async function handleShare(channel: 'whatsapp' | 'messenger' | 'email') {
    try {
      const result = await shareGpsPhoto(sharePhoto, channel)
      if (result.outcome === 'cancelled') return
      if (result.outcome === 'copied') {
        window.alert('Zpráva a odkaz byly zkopírovány do schránky. Přiložte staženou fotografii ke sdílení.')
      }
      if (result.outcome === 'downloaded' || result.outcome === 'opened') {
        window.alert('Fotografie s údaji byla stažena. Přiložte ji ke zprávě nebo e-mailu.')
      }
      await logShare(channel)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Sdílení fotografie se nezdařilo.')
    }
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
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => void handleShare('whatsapp')}
          className="w-full sm:w-auto"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => void handleShare('messenger')}
          className="w-full sm:w-auto"
        >
          <Send className="h-4 w-4" />
          Messenger
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => void handleShare('email')}
          className="w-full sm:w-auto"
        >
          <Mail className="h-4 w-4" />
          E-mail
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

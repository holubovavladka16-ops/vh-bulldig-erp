import { useState } from 'react'
import { Download, ExternalLink, FileText, Mail, MapPin, MessageCircle, Printer, Share2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { FDG_GPS_UNVERIFIED_LABEL } from '@/constants/fotodokumentaceGps'
import { formatDate, formatTime } from '@/constants/workers'
import {
  downloadGpsFotodokladPdf,
  previewGpsFotodokladPdf,
} from '@/lib/fotodokumentace-gps/gpsFotodokladPdf'
import { getGpsPhotoUrl, removeModulePhoto, updateModulePhotoNote } from '@/lib/fotodokumentace-gps/service'
import {
  getPhotoMapLinks,
  openEmailShare,
  openMessengerShare,
  openWhatsAppShare,
  sharePhotoPdf,
} from '@/lib/fotodokumentace-gps/share'
import { getMapyCzEmbedUrl } from '@/lib/photos/mapLinks'
import {
  formatGpsLocationLabel,
  formatPhotoAddress,
  getOrderDisplayName,
  getPhotoAuthorName,
} from '@/lib/photos/photoDisplay'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { GpsPhoto } from '@/types/photos'

interface FdgDetailModalProps {
  photo: GpsPhoto | null
  onClose: () => void
  onUpdated: () => void
}

export function FdgDetailModal({ photo, onClose, onUpdated }: FdgDetailModalProps) {
  const { user } = useAuth()
  const { settings: company } = useCompanySettings()
  const [note, setNote] = useState(photo?.note ?? '')
  const [busy, setBusy] = useState(false)

  if (!photo) return null

  const mapLinks = getPhotoMapLinks(photo)
  const gpsOk = photo.gps_lat != null && photo.gps_lng != null

  async function handleDelete() {
    if (!user || !photo) return
    if (!confirm('Smazat fotografii?')) return
    const toDelete = photo
    setBusy(true)
    try {
      await removeModulePhoto(toDelete, user.id)
      onUpdated()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="glass-panel max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border-glass)] p-4">
          <h2 className="text-lg font-semibold">Detail fotografie</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <img src={getGpsPhotoUrl(photo.file_path)} alt="" className="max-h-[50vh] w-full rounded-xl object-contain" />

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Meta label="Zakázka" value={getOrderDisplayName(photo)} />
            <Meta label="Datum" value={`${formatDate(photo.captured_date)} · ${formatTime(photo.captured_time)}`} />
            <Meta label="Autor" value={getPhotoAuthorName(photo)} />
            <Meta
              label="GPS"
              value={
                gpsOk
                  ? formatGpsLocationLabel(photo.gps_lat!, photo.gps_lng!, photo.gps_accuracy)
                  : FDG_GPS_UNVERIFIED_LABEL
              }
            />
            <Meta label="Adresa" value={formatPhotoAddress(photo)} className="sm:col-span-2" />
          </div>

          {gpsOk && (
            <iframe
              title="Mapa"
              src={getMapyCzEmbedUrl(photo.gps_lat!, photo.gps_lng!)}
              className="h-40 w-full rounded-xl border border-[var(--border-glass)]"
            />
          )}

          {mapLinks && (
            <div className="flex flex-wrap gap-3 text-sm">
              <a href={mapLinks.mapy} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--accent-primary)] underline">
                <ExternalLink className="h-4 w-4" /> Mapy.cz
              </a>
              <a href={mapLinks.google} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--accent-primary)] underline">
                <ExternalLink className="h-4 w-4" /> Google Maps
              </a>
              <a href={mapLinks.street} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--accent-primary)] underline">
                <ExternalLink className="h-4 w-4" /> Street View
              </a>
            </div>
          )}

          <Textarea label="Poznámka" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => previewGpsFotodokladPdf([photo], company)}>
              <FileText className="h-4 w-4" /> Náhled PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={() => downloadGpsFotodokladPdf([photo], company)}>
              <Download className="h-4 w-4" /> Stáhnout PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={() => previewGpsFotodokladPdf([photo], company)}>
              <Printer className="h-4 w-4" /> Vytisknout
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void sharePhotoPdf(photo, company)}>
              <Share2 className="h-4 w-4" /> Sdílet
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void openWhatsAppShare(photo, company)}>
              <MessageCircle className="h-4 w-4 text-green-400" /> WhatsApp
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void openMessengerShare(photo, company)}>
              <MessageCircle className="h-4 w-4 text-blue-400" /> Messenger
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void openEmailShare(photo, company)}>
              <Mail className="h-4 w-4" /> E-mail
            </Button>
            {mapLinks && (
              <Button size="sm" variant="secondary" onClick={() => window.open(mapLinks.mapy, '_blank')}>
                <MapPin className="h-4 w-4" /> Mapa
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={handleDelete} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Smazat
            </Button>
          </div>

          {user && note !== (photo.note ?? '') && (
            <Button
              size="sm"
              onClick={async () => {
                await updateModulePhotoNote(photo.id, note, user.id)
                onUpdated()
              }}
            >
              Uložit poznámku
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-theme-muted">{label}</p>
      <p className="font-medium text-theme-primary">{value}</p>
    </div>
  )
}

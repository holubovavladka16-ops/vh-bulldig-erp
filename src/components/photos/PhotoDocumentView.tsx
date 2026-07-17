import type { ReactNode } from 'react'
import {
  Clock,
  Eye,
  FileDown,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Send,
  Share2,
  Trash2,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { PhotoMiniMap } from '@/components/photos/PhotoMiniMap'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  getGoogleMapsUrl,
  getMapyCzUrl,
  getOpenStreetMapUrl,
  getStaticMapImageUrl,
  getStreetViewUrl,
} from '@/lib/photos/mapLinks'
import {
  buildPhotoShareText,
  getEmailShareUrl,
  getMessengerShareUrl,
  getWhatsAppShareUrl,
} from '@/lib/photos/share'
import { downloadPhotoReportHtml, printPhotoReport } from '@/lib/photos/photoReport'
import { logGpsPhotoShare } from '@/lib/photos/api'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatCaptureWeekday,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
  getOrderDisplayName,
  hasPhotoGps,
} from '@/lib/photos/photoDisplay'
import type { GpsPhoto } from '@/types/photos'

interface PhotoDocumentViewProps {
  photo: GpsPhoto
  note: string
  onNoteChange?: (value: string) => void
  onSaveNote?: () => void
  savingNote?: boolean
  userId?: string
  onDelete?: () => void
  deleting?: boolean
  onShared?: () => void
  /** Kompaktní náhled v galerii – bez akcí PDF/sdílení. */
  compact?: boolean
}

export function PhotoDocumentView({
  photo,
  note,
  onNoteChange,
  onSaveNote,
  savingNote = false,
  userId,
  onDelete,
  deleting = false,
  onShared,
  compact = false,
}: PhotoDocumentViewProps) {
  const { settings: company } = useCompanySettings()
  const sharePhoto = { ...photo, note: note || photo.note }
  const shareText = buildPhotoShareText(sharePhoto)
  const hasGps = hasPhotoGps(photo)
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const orderName = getOrderDisplayName(photo)
  const coords = formatGpsCoordinatesCompact(photo.gps_lat, photo.gps_lng)
  const address = formatPhotoAddress(photo)
  const weekday = formatCaptureWeekday(photo.captured_date)
  const dateLabel = formatCaptureDateLabel(photo.captured_date)
  const timeLabel = formatCaptureTime(photo.captured_time)
  const mapThumb = getStaticMapImageUrl(photo.gps_lat, photo.gps_lng, 200, 140)

  async function logShare(channel: string) {
    if (!userId) return
    await logGpsPhotoShare(photo.id, channel, userId)
    onShared?.()
  }

  function handleSavePdf() {
    downloadPhotoReportHtml(sharePhoto, company)
    void logShare('pdf_ulozeni')
  }

  function handlePrintPdf() {
    printPhotoReport(sharePhoto, company)
    void logShare('pdf_tisk')
  }

  async function handleNativeShare() {
    const payload = {
      title: `Fotodokumentace – ${orderName}`,
      text: shareText,
      url: mapUrl,
    }
    try {
      if (navigator.share) {
        await navigator.share(payload)
        await logShare('native_share')
        return
      }
      await navigator.clipboard.writeText(`${shareText}\n\n${mapUrl}`)
      await logShare('clipboard')
    } catch {
      // uživatel zrušil sdílení
    }
  }

  return (
    <article className="photo-document overflow-hidden rounded-2xl border border-[var(--accent-primary)]/40 bg-[var(--bg-glass)] shadow-[0_0_24px_var(--accent-glow)]">
      {/* Náhled fotografie s mapou a GPS štítkem */}
      <div className="relative bg-black/40">
        <img
          src={getGpsPhotoUrl(photo.file_path)}
          alt={photo.file_name}
          className="max-h-[420px] w-full object-contain sm:max-h-[480px]"
        />

        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-2 overflow-hidden rounded-lg border border-[var(--accent-primary)]/50 shadow-lg sm:right-3 sm:top-3"
          title="Otevřít mapu místa pořízení"
        >
          {mapThumb ? (
            <img src={mapThumb} alt="Mapa polohy" className="h-16 w-24 object-cover sm:h-20 sm:w-28" />
          ) : null}
        </a>

        <div className="absolute bottom-3 left-3 max-w-[85%] rounded-xl border border-[var(--accent-primary)]/60 bg-black/75 px-3 py-2 backdrop-blur-sm">
          <p className="truncate text-xs font-bold uppercase tracking-wide text-amber-300">{orderName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-white">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            {coords}
            {photo.gps_accuracy != null && (
              <span className="text-[10px] text-theme-muted">±{Math.round(photo.gps_accuracy)}m</span>
            )}
          </p>
        </div>
      </div>

      {/* Datum a čas */}
      <div className="flex items-start justify-between gap-3 border-t border-[var(--accent-primary)]/25 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted">{weekday}</p>
          <p className="mt-1 inline-block rounded-lg border border-[var(--accent-primary)]/40 px-3 py-1 text-lg font-bold text-theme-primary">
            {dateLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted">Čas pořízení:</p>
          <p className="mt-1 flex items-center justify-end gap-1.5 text-base font-bold text-amber-300">
            <Clock className="h-4 w-4" />
            {timeLabel}
          </p>
        </div>
        {!compact && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="touch-target rounded-lg p-2 text-red-400 hover:bg-red-500/10"
            aria-label="Smazat fotografii"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Adresa a pořizovatel */}
      <div className="border-t border-[var(--accent-primary)]/20 px-4 py-3">
        {photo.creator_name && (
          <p className="mb-3 flex items-center gap-2 text-sm text-theme-primary">
            <User className="h-4 w-4 shrink-0 text-theme-muted" />
            <span>
              <span className="text-theme-muted">Pořídil: </span>
              {photo.creator_name}
            </span>
          </p>
        )}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted">
          Zjištěná přesná adresa (č.p.):
        </p>
        <p className="mt-2 flex items-start gap-2 text-sm leading-snug text-theme-primary">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>{address}</span>
        </p>
        <p className="mt-2 font-mono text-xs text-theme-muted">
          GPS: {coords}
          {photo.gps_accuracy != null && ` · ±${Math.round(photo.gps_accuracy)} m`}
        </p>
        {!compact && hasGps && (
          <div className="mt-3">
            <PhotoMiniMap lat={photo.gps_lat} lng={photo.gps_lng} height={140} />
          </div>
        )}
      </div>

      {/* Poznámka */}
      {!compact && onNoteChange && (
        <div className="border-t border-[var(--accent-primary)]/20 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-theme-muted">
            Popis provedených prací / poznámka:
          </p>
          <Textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Přidejte popis prací…"
            rows={3}
          />
          {onSaveNote && (
            <Button size="sm" className="mt-2" onClick={onSaveNote} loading={savingNote}>
              Uložit poznámku
            </Button>
          )}
        </div>
      )}

      {compact && photo.note && (
        <div className="border-t border-[var(--accent-primary)]/20 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase text-theme-muted">Poznámka:</p>
          <p className="mt-1 text-sm text-theme-secondary">{photo.note}</p>
        </div>
      )}

      {!compact && userId && (
        <>
          {/* PDF */}
          <div className="border-t border-[var(--accent-primary)]/20 px-4 py-4">
            <Button
              type="button"
              className="w-full justify-center py-3 text-sm font-semibold uppercase tracking-wide"
              onClick={handleSavePdf}
            >
              <FileDown className="h-5 w-5" />
              Uložit PDF doklad s fotkou
            </Button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="mt-2 w-full text-center text-xs text-theme-muted hover:text-theme-primary"
            >
              nebo vytisknout PDF
            </button>
          </div>

          {/* Sdílení */}
          <div className="border-t border-[var(--accent-primary)]/20 px-4 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-theme-muted">
              Sdílení (WhatsApp / Messenger / e-mail):
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ShareLink
                href={getWhatsAppShareUrl(shareText)}
                onClick={() => logShare('whatsapp')}
                label="WhatsApp"
                icon={<MessageCircle className="h-5 w-5" />}
                className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
              />
              <ShareLink
                href={getEmailShareUrl(shareText)}
                onClick={() => logShare('email')}
                label="E-mail"
                icon={<Mail className="h-5 w-5" />}
                className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
              />
              <ShareLink
                href={getMessengerShareUrl(shareText, mapUrl)}
                onClick={() => logShare('messenger')}
                label="Messenger"
                icon={<Send className="h-5 w-5" />}
                className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
              />
              <button
                type="button"
                onClick={() => void handleNativeShare()}
                className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-violet-500/40 px-2 py-2 text-violet-300 transition hover:bg-violet-500/10"
              >
                <Share2 className="h-5 w-5" />
                <span className="text-[10px] font-semibold uppercase">Sdílet</span>
              </button>
            </div>
          </div>

          {/* Mapy */}
          <div className="grid grid-cols-3 gap-2 border-t border-[var(--accent-primary)]/20 px-4 py-4">
            <MapActionButton
              href={getMapyCzUrl(photo.gps_lat, photo.gps_lng)}
              label="Mapy"
              icon={<MapPin className="h-5 w-5 text-red-400" />}
              className="border-emerald-500/40"
            />
            <MapActionButton
              href={getStreetViewUrl(photo.gps_lat, photo.gps_lng)}
              label="Street View"
              icon={<Eye className="h-5 w-5" />}
              className="border-sky-500/40"
            />
            <MapActionButton
              href={getOpenStreetMapUrl(photo.gps_lat, photo.gps_lng)}
              label="Mapa"
              icon={<Map className="h-5 w-5 text-amber-300" />}
              className="border-amber-500/40"
            />
          </div>
        </>
      )}
    </article>
  )
}

function ShareLink({
  href,
  onClick,
  label,
  icon,
  className,
}: {
  href: string
  onClick: () => void
  label: string
  icon: ReactNode
  className: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 transition ${className}`}
    >
      {icon}
      <span className="text-[10px] font-semibold uppercase">{label}</span>
    </a>
  )
}

function MapActionButton({
  href,
  label,
  icon,
  className,
}: {
  href: string
  label: string
  icon: ReactNode
  className: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border bg-black/20 px-2 py-2 text-xs font-semibold uppercase text-theme-primary transition hover:bg-white/5 ${className}`}
    >
      {icon}
      {label}
    </a>
  )
}

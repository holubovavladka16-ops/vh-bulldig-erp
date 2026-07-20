import { Eye, Map, MapPin } from 'lucide-react'
import { PhotoMiniMap } from '@/components/photos/PhotoMiniMap'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  getGoogleMapsUrl,
  getMapyCzUrl,
  getStaticMapImageUrl,
  getStreetViewUrl,
} from '@/lib/photos/mapLinks'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatGpsLocationLabel,
  getOrderDisplayName,
  getPhotoAddressDetails,
} from '@/lib/photos/photoDisplay'
import type { GpsPhoto } from '@/types/photos'

interface DiaryPhotoLocationPanelProps {
  photo: GpsPhoto
  showMeta?: boolean
}

export function DiaryPhotoLocationPanel({ photo, showMeta = true }: DiaryPhotoLocationPanelProps) {
  if (photo.gps_lat == null || photo.gps_lng == null) {
    return (
      <p className="text-sm text-theme-muted">Fotografie nemá GPS souřadnice.</p>
    )
  }

  const lat = photo.gps_lat
  const lng = photo.gps_lng
  const { geocoded, structured } = getPhotoAddressDetails(photo)
  const coords = formatGpsLocationLabel(lat, lng, photo.gps_accuracy)
  const mapUrl = getGoogleMapsUrl(lat, lng)
  const mapyUrl = getMapyCzUrl(lat, lng)
  const streetViewUrl = getStreetViewUrl(lat, lng)
  const mapThumb = getStaticMapImageUrl(lat, lng, 220, 140)
  const author = photo.creator_name?.trim() || photo.worker_name?.trim() || '—'

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black/40">
        <img
          src={getGpsPhotoUrl(photo.file_path)}
          alt=""
          className="max-h-56 w-full object-contain"
        />
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Mapa s polohou (špendlík)"
          className="absolute right-2 top-2 overflow-hidden rounded-lg border border-[var(--accent-primary)]/50 shadow-lg"
        >
          <img src={mapThumb} alt="Mapa – špendlík" className="h-20 w-28 object-cover" />
        </a>
        <div className="absolute bottom-2 left-2 max-w-[90%] rounded-lg border border-emerald-500/40 bg-black/75 px-2.5 py-1.5 backdrop-blur-sm">
          <p className="truncate text-[10px] font-bold uppercase text-amber-300">{getOrderDisplayName(photo)}</p>
          <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-white">
            <MapPin className="h-3 w-3 shrink-0 text-emerald-400" />
            {coords}
          </p>
        </div>
      </div>

      <PhotoMiniMap lat={lat} lng={lng} height={150} />

      <div className="space-y-2 text-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-muted">
            Adresa (geokódovaná)
          </p>
          <p className="mt-0.5 flex items-start gap-1.5 text-theme-primary">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            {geocoded}
          </p>
        </div>

        {structured && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-muted">
              Adresa (ulice, obec, PSČ)
            </p>
            <p className="mt-0.5 text-theme-primary">{structured}</p>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-muted">GPS poloha</p>
          <p className="mt-0.5 font-mono text-theme-primary">{coords}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MapLink href={mapyUrl} label="Mapy.cz" icon={<MapPin className="h-4 w-4 text-red-400" />} />
        <MapLink href={streetViewUrl} label="Street View" icon={<Eye className="h-4 w-4" />} />
        <MapLink href={mapUrl} label="Google Maps" icon={<Map className="h-4 w-4 text-amber-300" />} />
      </div>

      {showMeta && (
        <div className="grid gap-2 border-t border-[var(--border-glass)] pt-2 text-sm sm:grid-cols-2">
          <Meta label="Datum a čas" value={`${formatCaptureDateLabel(photo.captured_date)} ${formatCaptureTime(photo.captured_time)}`} />
          <Meta label="Zakázka" value={getOrderDisplayName(photo)} />
          <Meta label="Autor" value={author} />
          <Meta label="Poznámka" value={photo.note?.trim() || '—'} />
        </div>
      )}
    </div>
  )
}

function MapLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border-glass)] bg-white/5 px-2 py-2 text-center text-[10px] font-semibold uppercase text-theme-secondary transition hover:bg-white/10"
    >
      {icon}
      {label}
    </a>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="text-theme-primary">{value}</p>
    </div>
  )
}

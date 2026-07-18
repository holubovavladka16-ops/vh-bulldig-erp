import { Eye, MapPin } from 'lucide-react'
import { PhotoMiniMap } from '@/components/photos/PhotoMiniMap'
import { getStreetViewEmbedUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'

interface PhotoLocationPreviewProps {
  lat: number
  lng: number
  address: string
  accuracy?: number
}

export function PhotoLocationPreview({ lat, lng, address, accuracy }: PhotoLocationPreviewProps) {
  const accuracyLabel =
    accuracy != null ? `±${accuracy < 10 ? accuracy.toFixed(1) : Math.round(accuracy)} m` : null
  const addressLabel = address.trim() || 'Adresa nedostupná'

  return (
    <div className="photo-location-preview space-y-2">
      <div className="rounded-lg border border-[var(--border-glass)] bg-white/5 px-2.5 py-2">
        <p className="flex items-start gap-1.5 text-xs text-theme-primary">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>{addressLabel}</span>
        </p>
        {accuracyLabel && (
          <p className="mt-1 pl-5 text-[10px] text-theme-muted">Přesnost GPS: {accuracyLabel}</p>
        )}
        <p className="mt-1 pl-5 font-mono text-[10px] text-theme-muted">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
      </div>

      <PhotoMiniMap lat={lat} lng={lng} height={120} className="w-full" />

      <a
        href={getStreetViewUrl(lat, lng)}
        target="_blank"
        rel="noopener noreferrer"
        className="photo-location-preview__street group relative block overflow-hidden rounded-xl border border-[var(--border-glass)] bg-white/5"
      >
        <iframe
          title={`Street View ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
          src={getStreetViewEmbedUrl(lat, lng)}
          className="pointer-events-none w-full border-0"
          style={{ height: '120px' }}
          loading="lazy"
        />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          <Eye className="h-3 w-3" />
          Street View
        </span>
      </a>
    </div>
  )
}

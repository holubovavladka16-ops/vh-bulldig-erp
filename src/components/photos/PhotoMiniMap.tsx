import type { MouseEvent } from 'react'
import { MapPin } from 'lucide-react'
import { getGoogleMapsUrl, getOpenStreetMapEmbedUrl } from '@/lib/photos/mapLinks'

interface PhotoMiniMapProps {
  lat: number
  lng: number
  height?: number
  className?: string
  onClick?: (event: MouseEvent) => void
}

export function PhotoMiniMap({
  lat,
  lng,
  height = 150,
  className = '',
  onClick,
}: PhotoMiniMapProps) {
  const mapsUrl = getGoogleMapsUrl(lat, lng)

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Otevřít polohu v Google Maps"
      className={`group relative block overflow-hidden rounded-xl border border-[var(--border-glass)] bg-white/5 ${className}`}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
    >
      <iframe
        title={`Mapa ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
        src={getOpenStreetMapEmbedUrl(lat, lng)}
        className="pointer-events-none w-full border-0"
        style={{ height: `${height}px` }}
        loading="lazy"
      />
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
        <MapPin className="h-3 w-3" />
        Mapa
      </span>
    </a>
  )
}

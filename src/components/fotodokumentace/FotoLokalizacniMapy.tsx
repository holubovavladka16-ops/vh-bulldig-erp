import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Eye, MapPin } from 'lucide-react'
import {
  getMapyCzEmbedUrl,
  getMapyCzShowMapUrl,
  getMapyCzUrl,
  getStreetViewEmbedUrl,
  getStreetViewUrl,
} from '@/lib/photos/mapLinks'

interface FotoLokalizacniMapyProps {
  lat: number
  lng: number
  accuracy?: number | null
  address?: string | null
  mapHeight?: number
  className?: string
}

export function FotoLokalizacniMapy({
  lat,
  lng,
  accuracy,
  address,
  mapHeight = 200,
  className = '',
}: FotoLokalizacniMapyProps) {
  const [mapyFailed, setMapyFailed] = useState(false)
  const mapyLoadedRef = useRef(false)

  useEffect(() => {
    mapyLoadedRef.current = false
    setMapyFailed(false)
    const timer = setTimeout(() => {
      if (!mapyLoadedRef.current) setMapyFailed(true)
    }, 4000)
    return () => clearTimeout(timer)
  }, [lat, lng])

  const mapyEmbed = getMapyCzEmbedUrl(lat, lng)
  const streetEmbed = getStreetViewEmbedUrl(lat, lng)
  const accLabel = accuracy != null ? `±${Math.round(accuracy)} m` : null

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-theme-primary">
          <MapPin className="h-4 w-4 text-red-400" />
          Poloha na mapě
        </p>
        {accLabel && (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            GPS {accLabel}
          </span>
        )}
      </div>

      {address && <p className="text-sm text-theme-secondary">{address}</p>}

      <p className="font-mono text-xs text-theme-muted">
        {lat.toFixed(6)}, {lng.toFixed(6)}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <MapPanel
          title="Mapy.cz"
          icon={<MapPin className="h-3.5 w-3.5 text-red-400" />}
          href={getMapyCzUrl(lat, lng)}
          hrefAlt={getMapyCzShowMapUrl(lat, lng)}
          height={mapHeight}
        >
          {!mapyFailed ? (
            <iframe
              title={`Mapy.cz – ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
              src={mapyEmbed}
              className="h-full w-full border-0"
              loading="eager"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => {
                mapyLoadedRef.current = true
              }}
            />
          ) : (
            <MapFallback lat={lat} lng={lng} label="Mapy.cz" href={getMapyCzUrl(lat, lng)} />
          )}
        </MapPanel>

        <MapPanel
          title="Street View"
          icon={<Eye className="h-3.5 w-3.5" />}
          href={getStreetViewUrl(lat, lng)}
          height={mapHeight}
        >
          <iframe
            title={`Street View – ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            src={streetEmbed}
            className="h-full w-full border-0"
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </MapPanel>
      </div>
    </div>
  )
}

function MapPanel({
  title,
  icon,
  href,
  hrefAlt,
  height,
  children,
}: {
  title: string
  icon: React.ReactNode
  href: string
  hrefAlt?: string
  height: number
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-glass)] bg-black/20">
      <div className="flex items-center justify-between border-b border-[var(--border-glass)] px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-theme-secondary">
          {icon}
          {title}
        </span>
        <a
          href={hrefAlt ?? href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-theme-muted transition hover:text-theme-primary"
        >
          <ExternalLink className="h-3 w-3" />
          Otevřít
        </a>
      </div>
      <div style={{ height: `${height}px` }} className="relative bg-[#1a1a2e]">
        {children}
      </div>
    </div>
  )
}

function MapFallback({
  lat,
  lng,
  label,
  href,
}: {
  lat: number
  lng: number
  label: string
  href: string
}) {
  const delta = 0.002
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`
  const osmEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`

  return (
    <div className="relative h-full w-full">
      <iframe
        title={`${label} – náhled`}
        src={osmEmbed}
        className="h-full w-full border-0 opacity-80"
        loading="eager"
      />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-center backdrop-blur-[1px] transition hover:bg-black/40"
      >
        <MapPin className="h-8 w-8 text-red-400" />
        <span className="text-sm font-semibold text-white">Otevřít v {label}</span>
        <span className="text-xs text-white/70">Interaktivní mapa v novém okně</span>
      </a>
    </div>
  )
}

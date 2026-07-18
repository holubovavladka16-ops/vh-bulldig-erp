import { ExternalLink, Loader2, MapPin, Satellite } from 'lucide-react'
import { PhotoMiniMap } from '@/components/photos/PhotoMiniMap'
import {
  formatAccuracyLabel,
  getAccuracyQuality,
  type PostCaptureGpsPhase,
} from '@/hooks/usePostCaptureGps'
import { getGoogleMapsUrl } from '@/lib/photos/mapLinks'
import { formatGpsCoordinatesCompact } from '@/lib/photos/photoDisplay'
import type { GeocodedAddress } from '@/types/photos'
import type { GpsPositionState } from '@/lib/photos/gpsWatch'

interface PostCaptureGpsPanelProps {
  phase: PostCaptureGpsPhase
  statusLabel: string
  position: GpsPositionState | null
  address: GeocodedAddress | null
  addressLoading: boolean
  error: string | null
  isImprecise: boolean
}

export function PostCaptureGpsPanel({
  phase,
  statusLabel,
  position,
  address,
  addressLoading,
  error,
  isImprecise,
}: PostCaptureGpsPanelProps) {
  const accuracy = position?.accuracy
  const quality = getAccuracyQuality(accuracy)
  const mapUrl = position ? getGoogleMapsUrl(position.lat, position.lng) : null

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-glass)] bg-white/5 p-3 text-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-theme-muted">
        <Satellite className="h-4 w-4 text-cyan-400" />
        Poloha fotografie
      </div>

      <p className="flex items-center gap-2 text-sm font-medium text-theme-primary">
        {(phase === 'locating' || phase === 'refining' || phase === 'geocoding' || addressLoading) && (
          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
        )}
        <span>Fotografie pořízena</span>
        {statusLabel ? <span className="text-theme-secondary">· {statusLabel}</span> : null}
      </p>

      {isImprecise && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Poloha není dostatečně přesná ({formatAccuracyLabel(accuracy)}). Upřesňuji GPS…
          Hodnota ±30 m není považována za přesný výsledek.
        </p>
      )}

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs text-theme-muted">GPS souřadnice</dt>
          <dd className="font-mono text-theme-primary">
            {position ? formatGpsCoordinatesCompact(position.lat, position.lng) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-theme-muted">Přesnost GPS</dt>
          <dd
            className={
              quality === 'excellent'
                ? 'text-emerald-400'
                : quality === 'acceptable'
                  ? 'text-cyan-300'
                  : 'text-theme-primary'
            }
          >
            {formatAccuracyLabel(accuracy)}
            {quality === 'excellent' && ' · výborná'}
            {quality === 'acceptable' && ' · přijatelná'}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <dt className="text-xs text-theme-muted">Adresa</dt>
            <dd className="text-theme-primary">
              {addressLoading && !address ? (
                <span className="flex items-center gap-1 text-theme-secondary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Adresa se doplňuje…
                </span>
              ) : (
                address?.address_full || 'Adresa se doplňuje…'
              )}
            </dd>
          </div>
        </div>
        {mapUrl && (
          <div>
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-cyan-200"
            >
              <ExternalLink className="h-4 w-4" />
              Otevřít na mapě
            </a>
          </div>
        )}
      </dl>

      {position && (
        <PhotoMiniMap lat={position.lat} lng={position.lng} height={120} />
      )}

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}

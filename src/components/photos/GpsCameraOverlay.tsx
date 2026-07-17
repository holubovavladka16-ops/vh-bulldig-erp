import { Loader2, MapPin, Satellite, Target } from 'lucide-react'
import {
  GPS_ACCEPTABLE_MAX_METERS,
  formatAccuracyMeters,
  type GpsAccuracyQuality,
} from '@/lib/photos/gpsCapture'
import type { GpsPreflightPhase } from '@/hooks/useGpsPreflight'
import type { GeocodedAddress } from '@/types/photos'
import type { GpsPositionState } from '@/lib/photos/gpsWatch'
import { LiveLocationMiniMap } from '@/components/photos/LiveLocationMiniMap'

interface GpsCameraOverlayProps {
  phase: GpsPreflightPhase
  position: GpsPositionState | null
  address: GeocodedAddress | null
  addressLoading: boolean
  error: string | null
  quality: GpsAccuracyQuality
  qualityLabel: string
  positionFromCache: boolean
  refining: boolean
  onRefine: () => void
}

export function GpsCameraOverlay({
  phase,
  position,
  address,
  addressLoading,
  error,
  quality,
  qualityLabel,
  positionFromCache,
  refining,
  onRefine,
}: GpsCameraOverlayProps) {
  const accuracyLabel = formatAccuracyMeters(position?.accuracy)
  const isSearching = refining || phase === 'initializing' || phase === 'searching'

  return (
    <div className="pointer-events-auto space-y-2">
      <div className="rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-medium text-white">
          <Satellite className="h-3.5 w-3.5 text-cyan-400" />
          {isSearching ? (
            <span className="flex items-center gap-1.5 text-amber-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Zpřesňuji polohu…
            </span>
          ) : quality === 'precise' ? (
            <span className="text-emerald-400">{qualityLabel}</span>
          ) : quality === 'acceptable' ? (
            <span className="text-cyan-200">{qualityLabel}</span>
          ) : quality === 'low' ? (
            <span className="text-amber-300">{qualityLabel}</span>
          ) : (
            <span className="text-white/80">GPS nedostupná – foto lze pořídit</span>
          )}
        </div>

        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div>
            <dt className="text-white/50">Souřadnice</dt>
            <dd className="font-mono text-white">
              {position ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-white/50">Přesnost</dt>
            <dd className={quality === 'precise' ? 'text-emerald-400' : quality === 'acceptable' ? 'text-cyan-200' : 'text-white'}>
              {accuracyLabel}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-white/50">Zdroj</dt>
            <dd className="text-white/90">
              {positionFromCache ? 'Cache / poslední známá poloha' : position ? 'GPS zařízení' : '—'}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="flex items-center gap-1 text-white/50">
              <MapPin className="h-3 w-3" />
              Adresa
            </dt>
            <dd className="line-clamp-2 text-white">
              {addressLoading && !address ? (
                <span className="flex items-center gap-1 text-white/60">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Načítám…
                </span>
              ) : (
                address?.address_full || (position ? '—' : 'GPS nedostupná')
              )}
            </dd>
          </div>
        </dl>
      </div>

      {position && (
        <LiveLocationMiniMap lat={position.lat} lng={position.lng} accuracy={position.accuracy} height={110} />
      )}

      {quality === 'low' && position && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-900/80 px-3 py-2 text-xs text-amber-100 backdrop-blur-md">
          <p>Přesnost {accuracyLabel} je nad {GPS_ACCEPTABLE_MAX_METERS} m. Focení je povoleno.</p>
          <button type="button" onClick={onRefine} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
            <Target className="h-3.5 w-3.5" />
            Zkusit zpřesnit
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-900/70 px-3 py-2 text-xs text-red-200 backdrop-blur-md">{error}</p>
      )}

      {!position && !error && (
        <p className="rounded-lg border border-white/20 bg-black/60 px-3 py-2 text-xs text-white/80 backdrop-blur-md">
          Foto lze pořídit i bez GPS. Poloha se doplní, pokud bude dostupná před uložením.
        </p>
      )}
    </div>
  )
}

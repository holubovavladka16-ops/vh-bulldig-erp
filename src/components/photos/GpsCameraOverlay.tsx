import { Loader2, MapPin, Satellite } from 'lucide-react'
import { GPS_TARGET_ACCURACY_METERS } from '@/lib/photos/geocoding'
import type { GpsPreflightPhase } from '@/hooks/useGpsPreflight'
import type { GeocodedAddress } from '@/types/photos'
import type { GpsPositionState, GpsTimingMetrics } from '@/lib/photos/gpsWatch'
import { LiveLocationMiniMap } from '@/components/photos/LiveLocationMiniMap'

interface GpsCameraOverlayProps {
  phase: GpsPreflightPhase
  position: GpsPositionState | null
  address: GeocodedAddress | null
  addressLoading: boolean
  error: string | null
  timing: GpsTimingMetrics
  onAcceptRelaxed: () => void
  onContinueSearching: () => void
}

function formatAccuracy(accuracy: number | undefined): string {
  if (accuracy == null) return '—'
  return `±${accuracy < 10 ? accuracy.toFixed(1) : Math.round(accuracy)} m`
}

function formatTimingMs(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function GpsCameraOverlay({
  phase,
  position,
  address,
  addressLoading,
  error,
  timing,
  onAcceptRelaxed,
  onContinueSearching,
}: GpsCameraOverlayProps) {
  const accuracy = position?.accuracy
  const accuracyLabel = formatAccuracy(accuracy)
  const isPrecise = accuracy != null && accuracy <= GPS_TARGET_ACCURACY_METERS
  const gpsSettled = phase === 'ready' || phase === 'relaxed'
  const isSearching = phase === 'initializing' || phase === 'waiting' || addressLoading
  const showReducedAccuracy = phase === 'relaxed' && !isPrecise

  return (
    <div className="pointer-events-auto space-y-2">
      <div className="rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-medium text-white">
          <Satellite className="h-3.5 w-3.5 text-cyan-400" />
          {gpsSettled && isPrecise ? (
            <span className="text-emerald-400">GPS přesná (±{GPS_TARGET_ACCURACY_METERS} m)</span>
          ) : showReducedAccuracy ? (
            <span className="text-amber-300">GPS: {accuracyLabel} (nejlepší za 5 s)</span>
          ) : isSearching ? (
            <span className="flex items-center gap-1.5 text-amber-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              GPS na pozadí… focení je volné
            </span>
          ) : (
            <span className="text-white/80">Sleduji GPS na pozadí…</span>
          )}
        </div>

        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div>
            <dt className="text-white/50">Souřadnice</dt>
            <dd className="font-mono text-white">
              {position
                ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-white/50">Přesnost</dt>
            <dd className={isPrecise ? 'text-emerald-400' : 'text-white'}>
              {accuracyLabel}
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
                  Načítám na pozadí…
                </span>
              ) : (
                address?.address_full || (position ? 'Adresa se doplní…' : '—')
              )}
            </dd>
          </div>
          {timing.firstFixMs != null && (
            <div className="col-span-2 border-t border-white/10 pt-1">
              <dt className="text-white/40">Časy GPS</dt>
              <dd className="text-white/60">
                První fix: {formatTimingMs(timing.firstFixMs)}
                {timing.targetReachedMs != null
                  ? ` · Cíl: ${formatTimingMs(timing.targetReachedMs)}`
                  : timing.settledMs != null
                    ? ` · Ustáleno: ${formatTimingMs(timing.settledMs)}`
                    : ''}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <LiveLocationMiniMap
        lat={position?.lat ?? null}
        lng={position?.lng ?? null}
        accuracy={position?.accuracy}
        height={110}
      />

      {phase === 'timeout_prompt' && position && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-900/80 px-3 py-2 text-xs text-amber-100 backdrop-blur-md">
          <p>Přesnost ±{GPS_TARGET_ACCURACY_METERS} m se nepodařilo. Aktuální: {accuracyLabel}.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onAcceptRelaxed}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              Focení povolit
            </button>
            <button
              type="button"
              onClick={onContinueSearching}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white"
            >
              Hledat dál
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-900/70 px-3 py-2 text-xs text-red-200 backdrop-blur-md">
          {error}
        </p>
      )}
    </div>
  )
}

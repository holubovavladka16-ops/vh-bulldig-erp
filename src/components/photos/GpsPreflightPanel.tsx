import { Loader2, Satellite, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  GPS_ACCEPTABLE_MAX_METERS,
  formatAccuracyMeters,
  gpsAccuracyQualityLabel,
  type GpsAccuracyQuality,
} from '@/lib/photos/gpsCapture'
import { formatDeviceOrientation, getDeviceOrientation } from '@/lib/photos/gpsWatch'
import type { GpsPreflightPhase } from '@/hooks/useGpsPreflight'
import type { GeocodedAddress } from '@/types/photos'
import type { GpsPositionState } from '@/lib/photos/gpsWatch'

interface GpsPreflightPanelProps {
  phase: GpsPreflightPhase
  position: GpsPositionState | null
  address: GeocodedAddress | null
  addressLoading: boolean
  error: string | null
  quality?: GpsAccuracyQuality
  positionFromCache?: boolean
  refining?: boolean
  onAcceptRelaxed: () => void
  onContinueSearching: () => void
}

export function GpsPreflightPanel({
  phase,
  position,
  address,
  addressLoading,
  error,
  quality,
  positionFromCache = false,
  refining = false,
  onAcceptRelaxed,
  onContinueSearching,
}: GpsPreflightPanelProps) {
  const orientation = formatDeviceOrientation(getDeviceOrientation())
  const accuracyLabel = formatAccuracyMeters(position?.accuracy)
  const qualityLabel = quality ? gpsAccuracyQualityLabel(quality) : '—'
  const isSearching = refining || phase === 'initializing' || phase === 'searching'
  const gpsReady = position != null && (phase === 'precise' || phase === 'acceptable' || phase === 'low')

  return (
    <div className="mb-6 space-y-4 rounded-xl border border-[var(--border-glass)] p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-theme-primary">
        <Satellite className="h-4 w-4 text-accent" />
        {isSearching ? (
          <span className="flex items-center gap-2 text-theme-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Zpřesňuji polohu…
          </span>
        ) : phase === 'precise' ? (
          <span className="text-emerald-400">{qualityLabel}</span>
        ) : phase === 'acceptable' ? (
          <span className="text-cyan-300">{qualityLabel}</span>
        ) : phase === 'low' ? (
          <span className="text-amber-300">{qualityLabel}</span>
        ) : phase === 'denied' ? (
          <span className="text-red-300">Přístup k poloze zamítnut</span>
        ) : (
          <span className="text-theme-secondary">GPS nedostupná</span>
        )}
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-theme-muted">Přesnost GPS</dt>
          <dd className="font-medium text-theme-primary">{accuracyLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-theme-muted">Souřadnice</dt>
          <dd className="font-mono text-xs text-theme-primary">
            {position ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}` : '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-theme-muted">Zdroj polohy</dt>
          <dd className="text-theme-primary">
            {positionFromCache ? 'Cache / poslední známá poloha' : position ? 'GPS zařízení' : '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-theme-muted">Adresa</dt>
          <dd className="text-theme-primary">
            {addressLoading && !address ? (
              <span className="flex items-center gap-2 text-theme-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Načítám adresu…
              </span>
            ) : (
              address?.address_full || '—'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-theme-muted">Orientace telefonu</dt>
          <dd className="text-theme-primary">{orientation}</dd>
        </div>
      </dl>

      {quality === 'low' && position && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p>
            Přesnost {accuracyLabel} je nad {GPS_ACCEPTABLE_MAX_METERS} m.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" size="sm" onClick={onContinueSearching}>
              <Target className="h-4 w-4" />
              Zkusit zpřesnit
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onAcceptRelaxed}>
              Pokračovat
            </Button>
          </div>
        </div>
      )}

      {!position && !error && (
        <p className="text-xs text-amber-700">
          GPS zatím není k dispozici. Měření pokračuje na pozadí (max. 5 s).
        </p>
      )}

      {gpsReady && quality !== 'low' && (
        <p className="text-xs text-emerald-400">Poloha je připravena k použití.</p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}

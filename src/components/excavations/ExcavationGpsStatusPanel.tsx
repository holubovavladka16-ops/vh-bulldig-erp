import { Loader2, Navigation, Satellite } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatGpsAccuracy, formatGpsCoordinates } from '@/lib/excavations/geometry'
import type { ExcavationGpsPhase } from '@/hooks/useExcavationGpsLocate'
import type { GpsPositionState } from '@/lib/photos/gpsWatch'
import type { GeocodedAddress } from '@/types/photos'

interface ExcavationGpsStatusPanelProps {
  phase: ExcavationGpsPhase
  position: GpsPositionState | null
  address: GeocodedAddress | null
  addressLoading?: boolean
  error: string | null
  onRetry?: () => void
}

export function ExcavationGpsStatusPanel({
  phase,
  position,
  address,
  addressLoading,
  error,
  onRetry,
}: ExcavationGpsStatusPanelProps) {
  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-glass)] p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-theme-primary">
        <Satellite className="h-4 w-4 text-accent" />
        {phase === 'active' ? (
          <span className="text-emerald-400">GPS aktivní – poloha se aktualizuje</span>
        ) : phase === 'locating' ? (
          <span className="flex items-center gap-2 text-theme-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Zaměřuji polohu…
          </span>
        ) : phase === 'error' ? (
          <span className="text-red-300">GPS nedostupné</span>
        ) : (
          <span className="text-theme-muted">GPS neaktivní</span>
        )}
      </div>

      {phase === 'active' && position && (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-theme-muted">GPS souřadnice</dt>
            <dd className="font-mono text-xs text-theme-primary">
              {formatGpsCoordinates({ lat: position.lat, lng: position.lng })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-theme-muted">Přesnost GPS</dt>
            <dd className="font-medium text-emerald-400">{formatGpsAccuracy(position.accuracy)}</dd>
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
        </dl>
      )}

      {error && (
        <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <p>{error}</p>
          {onRetry ? (
            <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
              <Navigation className="h-4 w-4" />
              Znovu požádat o polohu
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}

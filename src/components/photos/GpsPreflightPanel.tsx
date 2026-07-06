import { Loader2, Satellite } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GPS_TARGET_ACCURACY_METERS } from '@/lib/photos/geocoding'
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
  onAcceptRelaxed: () => void
  onContinueSearching: () => void
}

export function GpsPreflightPanel({
  phase,
  position,
  address,
  addressLoading,
  error,
  onAcceptRelaxed,
  onContinueSearching,
}: GpsPreflightPanelProps) {
  const orientation = formatDeviceOrientation(getDeviceOrientation())
  const accuracy = position?.accuracy
  const accuracyLabel =
    accuracy != null ? `±${accuracy < 10 ? accuracy.toFixed(1) : Math.round(accuracy)} m` : '—'

  const showWaitingMessage =
    phase === 'initializing' ||
    phase === 'waiting' ||
    (phase === 'timeout_prompt' && !position)

  return (
    <div className="mb-6 space-y-4 rounded-xl border border-[var(--border-glass)] p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-theme-primary">
        <Satellite className="h-4 w-4 text-accent" />
        {phase === 'ready' ? (
          <span className="text-emerald-400">✅ GPS připravena</span>
        ) : phase === 'relaxed' ? (
          <span className="text-amber-300">📷 Focení povoleno (snížená přesnost)</span>
        ) : showWaitingMessage ? (
          <span className="flex items-center gap-2 text-theme-secondary">
            {(phase === 'initializing' || addressLoading) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            🛰 Hledám polohu…
          </span>
        ) : (
          <span className="text-theme-secondary">🛰 Sleduji polohu…</span>
        )}
      </div>

      {phase === 'waiting' && position && (
        <p className="text-sm text-theme-secondary">Čekám na přesnější GPS…</p>
      )}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-theme-muted">Přesnost GPS</dt>
          <dd
            className={`font-medium ${
              accuracy != null && accuracy <= GPS_TARGET_ACCURACY_METERS
                ? 'text-emerald-400'
                : 'text-theme-primary'
            }`}
          >
            {accuracyLabel}
            {accuracy != null && accuracy <= GPS_TARGET_ACCURACY_METERS && ' ✓'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-theme-muted">Souřadnice</dt>
          <dd className="font-mono text-xs text-theme-primary">
            {position
              ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
              : '—'}
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

      {phase === 'timeout_prompt' && position && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-medium">
            Přesnost ±{GPS_TARGET_ACCURACY_METERS} m se nepodařilo získat.
          </p>
          <p className="mt-2">
            Aktuální přesnost je {accuracyLabel}.
          </p>
          <p className="mt-2">Chcete fotografii uložit i s touto přesností?</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" size="sm" onClick={onAcceptRelaxed}>
              Uložit
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onContinueSearching}>
              Pokračovat v hledání GPS
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}

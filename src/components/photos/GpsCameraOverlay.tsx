import { useState } from 'react'
import { ChevronDown, Loader2, MapPin, Satellite } from 'lucide-react'
import { GPS_TARGET_ACCURACY_METERS } from '@/lib/photos/geocoding'
import type { GpsPreflightPhase, AddressStatus } from '@/hooks/useGpsPreflight'
import { getAddressDisplayLabel } from '@/hooks/useGpsPreflight'
import type { GeocodedAddress } from '@/types/photos'
import type { GpsPositionState } from '@/lib/photos/gpsWatch'
import { LiveLocationMiniMap } from '@/components/photos/LiveLocationMiniMap'

interface GpsCameraOverlayProps {
  phase: GpsPreflightPhase
  position: GpsPositionState | null
  address: GeocodedAddress | null
  addressStatus: AddressStatus
  error: string | null
  onAcceptRelaxed: () => void
  onContinueSearching: () => void
}

function gpsStatusLabel(phase: GpsPreflightPhase, isSearchingGps: boolean, gpsReady: boolean): string {
  if (gpsReady) return 'GPS připravena'
  if (isSearchingGps) return 'Zaměřuji polohu…'
  if (phase === 'timeout_prompt') return 'Čeká na potvrzení'
  return 'Sleduji GPS…'
}

export function GpsCameraOverlay({
  phase,
  position,
  address,
  addressStatus,
  error,
  onAcceptRelaxed,
  onContinueSearching,
}: GpsCameraOverlayProps) {
  const [expanded, setExpanded] = useState(false)

  const accuracy = position?.accuracy
  const accuracyLabel =
    accuracy != null ? `±${accuracy < 10 ? accuracy.toFixed(1) : Math.round(accuracy)} m` : '—'

  const gpsReady = phase === 'ready' || phase === 'relaxed'
  const isSearchingGps = phase === 'initializing' || phase === 'waiting'
  const addressLabel = getAddressDisplayLabel(address, addressStatus)
  const addressIsLoading = addressStatus === 'loading'
  const statusLabel = gpsStatusLabel(phase, isSearchingGps, gpsReady)

  return (
    <div className="gps-camera-overlay pointer-events-auto">
      <div className="gps-camera-strip">
        <button
          type="button"
          className="gps-camera-strip__toggle"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          <ChevronDown className={`gps-camera-strip__chevron ${expanded ? 'gps-camera-strip__chevron--open' : ''}`} />
          <Satellite className="h-3 w-3 shrink-0 text-cyan-400" />
          <span>GPS informace</span>
        </button>

        {!expanded && (
          <div className="gps-camera-strip__compact">
            <p className="gps-camera-strip__row">
              <span className={`gps-camera-strip__status ${gpsReady ? 'gps-camera-strip__status--ready' : ''}`}>
                {isSearchingGps && <Loader2 className="inline h-3 w-3 animate-spin" />}
                {statusLabel}
              </span>
              <span
                className={
                  accuracy != null && accuracy <= GPS_TARGET_ACCURACY_METERS
                    ? 'gps-camera-strip__accuracy gps-camera-strip__accuracy--ok'
                    : 'gps-camera-strip__accuracy'
                }
              >
                {accuracyLabel}
              </span>
            </p>
            <p className="gps-camera-strip__address" title={addressLabel}>
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {addressIsLoading ? (
                <span className="flex min-w-0 items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  {addressLabel}
                </span>
              ) : (
                addressLabel
              )}
            </p>
          </div>
        )}

        {expanded && (
          <div className="gps-camera-strip__details">
            <dl className="gps-camera-strip__meta">
              <div>
                <dt>Stav</dt>
                <dd className={gpsReady ? 'text-emerald-400' : undefined}>{statusLabel}</dd>
              </div>
              <div>
                <dt>Přesnost</dt>
                <dd
                  className={
                    accuracy != null && accuracy <= GPS_TARGET_ACCURACY_METERS
                      ? 'text-emerald-400'
                      : undefined
                  }
                >
                  {accuracyLabel}
                </dd>
              </div>
              <div className="gps-camera-strip__meta-wide">
                <dt>Adresa</dt>
                <dd>{addressIsLoading ? addressLabel : addressLabel}</dd>
              </div>
              <div className="gps-camera-strip__meta-wide">
                <dt>Souřadnice</dt>
                <dd className="font-mono">
                  {position
                    ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
                    : '—'}
                </dd>
              </div>
            </dl>

            <LiveLocationMiniMap
              lat={position?.lat ?? null}
              lng={position?.lng ?? null}
              accuracy={position?.accuracy}
              height={80}
              className="gps-camera-strip__map"
            />
          </div>
        )}
      </div>

      {phase === 'timeout_prompt' && position && (
        <div className="gps-camera-strip__prompt">
          <p>
            Přesnost ±{GPS_TARGET_ACCURACY_METERS} m se nepodařilo. Aktuální: {accuracyLabel}.
          </p>
          <div className="mt-1.5 flex gap-2">
            <button type="button" onClick={onAcceptRelaxed} className="gps-camera-strip__btn gps-camera-strip__btn--ok">
              Focení povolit
            </button>
            <button type="button" onClick={onContinueSearching} className="gps-camera-strip__btn">
              Hledat dál
            </button>
          </div>
        </div>
      )}

      {error && <p className="gps-camera-strip__error">{error}</p>}
    </div>
  )
}

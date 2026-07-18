import { useState } from 'react'
import { Flag, MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GpsPreflightPanel } from '@/components/photos/GpsPreflightPanel'
import { useGpsPreflight } from '@/hooks/useGpsPreflight'
import { formatGpsAccuracy, formatGpsCoordinates } from '@/lib/excavations/geometry'
import type { ExcavationPoint } from '@/types/excavations'

export interface GpsWalkResult {
  points: ExcavationPoint[]
  label: string
  mapFocus: { lat: number; lng: number; zoom: number; accuracy?: number }
}

interface GpsWalkMeasurementPanelProps {
  disabled?: boolean
  onComplete: (result: GpsWalkResult) => void
  onCancel: () => void
}

export function GpsWalkMeasurementPanel({
  disabled,
  onComplete,
  onCancel,
}: GpsWalkMeasurementPanelProps) {
  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [startPoint, setStartPoint] = useState<ExcavationPoint | null>(null)

  const gps = useGpsPreflight(gpsEnabled)

  const gpsReady =
    gps.position != null &&
    (gps.phase === 'ready' || gps.phase === 'relaxed')

  function startGpsLocate() {
    setGpsEnabled(true)
    setStartPoint(null)
  }

  function captureStartPoint() {
    if (!gps.position) return
    setStartPoint({
      lat: gps.position.lat,
      lng: gps.position.lng,
      accuracy: gps.position.accuracy,
      label: 'Start',
    })
  }

  function captureEndPoint() {
    if (!gps.position || !startPoint) return
    const endPoint: ExcavationPoint = {
      lat: gps.position.lat,
      lng: gps.position.lng,
      accuracy: gps.position.accuracy,
      label: 'Konec',
    }
    const points = [startPoint, endPoint]
    const centerLat = (startPoint.lat + endPoint.lat) / 2
    const centerLng = (startPoint.lng + endPoint.lng) / 2

    onComplete({
      points,
      label: 'Měření chůzí (GPS)',
      mapFocus: {
        lat: centerLat,
        lng: centerLng,
        zoom: 18,
      },
    })
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-glass)] p-4">
      <div>
        <h3 className="font-semibold text-theme-primary">Měření chůzí podle GPS</h3>
        <p className="mt-1 text-sm text-theme-muted">
          Zaměřte polohu, označte bod Start, projděte se na druhé místo a označte bod Konec.
          Aplikace spočítá vzdálenost mezi oběma body.
        </p>
      </div>

      {!gpsEnabled ? (
        <Button type="button" onClick={startGpsLocate} disabled={disabled} className="w-full sm:w-auto">
          <Navigation className="h-4 w-4" />
          Zaměřit moji polohu
        </Button>
      ) : (
        <>
          <GpsPreflightPanel
            phase={gps.phase}
            position={gps.position}
            address={gps.address}
            addressStatus={gps.addressStatus}
            error={gps.error}
            onAcceptRelaxed={gps.acceptRelaxedAccuracy}
            onContinueSearching={gps.continueSearching}
          />

          {!startPoint && gpsReady && (
            <Button type="button" onClick={captureStartPoint} disabled={disabled} className="w-full">
              <Flag className="h-4 w-4" />
              Bod 1 / Start
            </Button>
          )}

          {startPoint && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
                <p className="font-medium text-emerald-400">Bod 1 / Start zaznamenán</p>
                <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-theme-muted">GPS souřadnice</dt>
                    <dd className="font-mono text-theme-primary">{formatGpsCoordinates(startPoint)}</dd>
                  </div>
                  <div>
                    <dt className="text-theme-muted">Přesnost GPS</dt>
                    <dd className="text-theme-primary">{formatGpsAccuracy(startPoint.accuracy)}</dd>
                  </div>
                </dl>
              </div>

              <p className="text-sm text-amber-300">
                Nyní fyzicky projděte na druhé místo. Po příchodu klikněte na tlačítko níže –
                aplikace zaznamená vaši aktuální GPS polohu jako bod Konec.
              </p>

              {gpsReady ? (
                <Button type="button" onClick={captureEndPoint} disabled={disabled} className="w-full">
                  <MapPin className="h-4 w-4" />
                  Bod 2 / Konec
                </Button>
              ) : (
                <p className="text-sm text-theme-muted">Čekám na GPS polohu pro bod Konec…</p>
              )}
            </div>
          )}
        </>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
        Zrušit měření
      </Button>
    </div>
  )
}

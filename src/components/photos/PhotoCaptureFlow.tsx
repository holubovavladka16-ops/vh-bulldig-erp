import { useEffect, useState, type ChangeEvent } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
  ExternalLink,
  ImagePlus,
  Loader2,
  MapPin,
  Satellite,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import '@/styles/photoMap.css'
import { GpsCameraOverlay } from '@/components/photos/GpsCameraOverlay'
import { useGpsPreflight } from '@/hooks/useGpsPreflight'
import { useCameraStream } from '@/hooks/useCameraStream'
import { getDeviceOrientation } from '@/lib/photos/gpsWatch'
import { reverseGeocode } from '@/lib/photos/geocoding'
import { geocodeFallbackAddress, formatGpsCoordinatesCompact } from '@/lib/photos/photoDisplay'
import { getGoogleMapsUrl } from '@/lib/photos/mapLinks'
import { createGpsPhoto } from '@/lib/photos/api'
import { fetchJobOrders } from '@/lib/orders/api'
import type { GpsPositionState } from '@/lib/photos/gpsWatch'
import type { GeocodedAddress } from '@/types/photos'

type CapturePhase = 'camera' | 'save'

interface CapturedSnapshot {
  file: File
  previewUrl: string
  position: GpsPositionState | null
  address: GeocodedAddress | null
  capturedAt: Date
  deviceHeading: number | null
}

export interface PhotoCaptureFlowProps {
  active: boolean
  uploadedBy: string
  creatorName: string
  constructionPointId?: string
  defaultOrderId?: string
  lockOrder?: boolean
  onCreated: () => void
  onCancel?: () => void
  /** Kompaktní režim bez horní navigace (uvnitř modalu). */
  compact?: boolean
}

function formatGpsAccuracy(accuracy: number): string {
  return `±${accuracy < 10 ? accuracy.toFixed(1) : Math.round(accuracy)} m`
}

export function PhotoCaptureFlow({
  active,
  uploadedBy,
  creatorName,
  constructionPointId,
  defaultOrderId,
  lockOrder = false,
  onCreated,
  onCancel,
  compact = false,
}: PhotoCaptureFlowProps) {
  const [phase, setPhase] = useState<CapturePhase>('camera')
  const [snapshot, setSnapshot] = useState<CapturedSnapshot | null>(null)
  const [orderId, setOrderId] = useState('')
  const [note, setNote] = useState('')
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [resolvingGps, setResolvingGps] = useState(false)
  const [error, setError] = useState('')

  const gps = useGpsPreflight(active)
  const camera = useCameraStream({ enabled: active && phase === 'camera' })

  const canCapture = camera.isActive && !saving

  useEffect(() => {
    if (!active) return
    setPhase('camera')
    setSnapshot(null)
    setNote('')
    setOrderId(defaultOrderId ?? '')
    setError('')
    setSaving(false)
    setResolvingGps(false)

    fetchJobOrders().then((orders) => {
      setOrderOptions([
        { value: '', label: '— Vyberte zakázku —' },
        ...orders.map((o) => ({ value: o.id, label: o.name })),
      ])
    })
  }, [active, defaultOrderId])

  useEffect(() => {
    return () => {
      if (snapshot?.previewUrl) URL.revokeObjectURL(snapshot.previewUrl)
    }
  }, [snapshot?.previewUrl])

  if (!active) return null

  async function resolveAddressForPosition(pos: GpsPositionState): Promise<GeocodedAddress> {
    try {
      return await reverseGeocode(pos.lat, pos.lng)
    } catch {
      return geocodeFallbackAddress(pos.lat, pos.lng)
    }
  }

  async function takeSnapshot(file: File) {
    const position = gps.getCurrentBestPosition()
    const address =
      gps.address ??
      (position ? geocodeFallbackAddress(position.lat, position.lng) : null)
    const previewUrl = URL.createObjectURL(file)

    setSnapshot({
      file,
      previewUrl,
      position: position ? { ...position } : null,
      address,
      capturedAt: new Date(),
      deviceHeading: getDeviceOrientation() ?? position?.heading ?? null,
    })
    setPhase('save')
    setError('')
    camera.stop()

    if (position && !gps.address) {
      void resolveAddressForPosition(position).then((resolved) => {
        setSnapshot((prev) =>
          prev ? { ...prev, address: resolved } : prev
        )
      })
    }
  }

  async function handleCameraCapture() {
    if (!canCapture) return
    const file = await camera.captureFrame()
    if (!file) {
      setError('Snímek se nepodařilo pořídit. Zkuste znovu nebo použijte Galerie.')
      return
    }
    await takeSnapshot(file)
  }

  function handleGalleryInput(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (selected) void takeSnapshot(selected)
  }

  function handleRetake() {
    if (snapshot?.previewUrl) URL.revokeObjectURL(snapshot.previewUrl)
    setSnapshot(null)
    setPhase('camera')
    setError('')
  }

  async function resolveSnapshotGps(): Promise<CapturedSnapshot | null> {
    if (!snapshot) return null

    let position = snapshot.position
    if (!position) {
      setResolvingGps(true)
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        const best = gps.getCurrentBestPosition()
        if (best) {
          position = { ...best }
          break
        }
        await new Promise((r) => setTimeout(r, 200))
      }
      setResolvingGps(false)
    }

    if (!position) return null

    const address =
      snapshot.address ?? (await resolveAddressForPosition(position))

    return { ...snapshot, position, address }
  }

  async function handleSave() {
    if (!snapshot) return
    if (!orderId) {
      setError('Vyberte zakázku.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const resolved = await resolveSnapshotGps()
      if (!resolved?.position) {
        setError(
          'GPS poloha zatím není dostupná. Povolte polohu v prohlížeči a na telefonu, nebo vyfotografujte znovu.'
        )
        return
      }

      const finalAddress =
        resolved.address ??
        geocodeFallbackAddress(resolved.position.lat, resolved.position.lng)

      await createGpsPhoto(
        {
          file: resolved.file,
          captured_at: resolved.capturedAt,
          gps_lat: resolved.position.lat,
          gps_lng: resolved.position.lng,
          gps_accuracy: resolved.position.accuracy,
          device_heading: resolved.deviceHeading,
          ...finalAddress,
          note,
          order_id: orderId,
          construction_point_id: constructionPointId ?? null,
        },
        uploadedBy
      )
      if (resolved.previewUrl) URL.revokeObjectURL(resolved.previewUrl)
      setSnapshot(null)
      setPhase('camera')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setSaving(false)
      setResolvingGps(false)
    }
  }

  if (phase === 'camera') {
    return (
      <div className={`photo-capture-flow ${compact ? '' : 'photo-capture-flow--page'}`}>
        {!compact && onCancel && (
          <div className="mb-3 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4" />
              Galerie
            </Button>
            <p className="text-sm text-theme-muted">Kamera ihned · GPS na pozadí (max. 5 s)</p>
          </div>
        )}

        <div className="photo-camera-shell">
          <div className="photo-camera-viewport">
            {camera.isActive ? (
              <video
                ref={camera.videoRef}
                className="photo-camera-video"
                playsInline
                muted
                autoPlay
              />
            ) : (
              <div className="photo-camera-placeholder">
                <Camera className="h-12 w-12 text-white/40" />
                <p className="mt-3 text-sm text-white/70">
                  {camera.phase === 'starting'
                    ? 'Spouštím kameru…'
                    : camera.error || 'Kamera se připravuje…'}
                </p>
              </div>
            )}

            <div className="photo-camera-overlay">
              <GpsCameraOverlay
                phase={gps.phase}
                position={gps.bestPosition ?? gps.position}
                address={gps.address}
                addressLoading={gps.addressLoading}
                error={gps.error}
                timing={gps.timing}
                onAcceptRelaxed={gps.acceptRelaxedAccuracy}
                onContinueSearching={gps.continueSearching}
              />
            </div>
          </div>

          <div className="photo-camera-actions">
            <button
              type="button"
              className={`photo-capture-btn photo-capture-btn--primary ${!canCapture ? 'photo-capture-btn--disabled' : ''}`}
              disabled={!canCapture}
              onClick={() => void handleCameraCapture()}
            >
              <Camera className="h-6 w-6" />
              Vyfotit
            </button>

            <label
              className={`photo-capture-btn photo-capture-btn--secondary ${!canCapture ? 'photo-capture-btn--disabled' : ''}`}
            >
              <ImagePlus className="h-5 w-5" />
              Galerie
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!canCapture}
                onChange={handleGalleryInput}
              />
            </label>
          </div>

          {!gps.hasLocation && camera.isActive && (
            <p className="mt-2 text-center text-xs text-amber-300">
              <Satellite className="mr-1 inline h-3.5 w-3.5" />
              Focení je volné. GPS se načítá na pozadí – použije se nejlepší poloha (max. 5 s).
            </p>
          )}

          {camera.error && camera.phase !== 'active' && (
            <p className="mt-2 text-center text-xs text-theme-muted">{camera.error}</p>
          )}

          {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
        </div>
      </div>
    )
  }

  if (!snapshot) return null

  const dateStr = snapshot.capturedAt.toLocaleDateString('cs-CZ')
  const timeStr = snapshot.capturedAt.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const mapUrl = snapshot.position
    ? getGoogleMapsUrl(snapshot.position.lat, snapshot.position.lng)
    : null

  return (
    <div className={`photo-capture-flow ${compact ? '' : 'photo-capture-flow--page'}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-theme-primary">Uložit fotografii</h2>
        <Button type="button" variant="secondary" size="sm" onClick={handleRetake} disabled={saving}>
          <Camera className="h-4 w-4" />
          Vyfotit znovu
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-[var(--border-glass)] bg-black/40">
          <img
            src={snapshot.previewUrl}
            alt="Pořízená fotografie"
            className="max-h-[360px] w-full object-contain"
          />
        </div>

        <div className="space-y-4">
          <Select
            label="Zakázka"
            options={orderOptions}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            disabled={saving || lockOrder}
          />

          <Textarea
            label="Poznámka"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Popis provedených prací…"
            rows={3}
            disabled={saving}
          />

          <div className="rounded-xl border border-[var(--border-glass)] bg-white/5 p-3 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-theme-muted">
              Automaticky doplněno
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" />
                <div>
                  <dt className="text-xs text-theme-muted">Pořídil</dt>
                  <dd className="text-theme-primary">{creatorName}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs text-theme-muted">Datum a čas</dt>
                <dd className="text-theme-primary">
                  {dateStr} · {timeStr}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-theme-muted">GPS souřadnice</dt>
                <dd className="font-mono text-theme-primary">
                  {snapshot.position
                    ? formatGpsCoordinatesCompact(snapshot.position.lat, snapshot.position.lng)
                    : resolvingGps
                      ? 'Načítám GPS…'
                      : 'Čeká na GPS…'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-theme-muted">Přesnost GPS</dt>
                <dd className="text-theme-primary">
                  {snapshot.position
                    ? formatGpsAccuracy(snapshot.position.accuracy)
                    : '—'}
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <dt className="text-xs text-theme-muted">Adresa</dt>
                  <dd className="text-theme-primary">
                    {snapshot.address?.address_full ?? 'Načítám adresu…'}
                  </dd>
                  {snapshot.address && (
                    <dd className="mt-1 text-xs text-theme-muted">
                      {[snapshot.address.street, snapshot.address.city, snapshot.address.postal_code, snapshot.address.country]
                        .filter(Boolean)
                        .join(', ')}
                    </dd>
                  )}
                </div>
              </div>
              {mapUrl && (
                <div>
                  <dt className="text-xs text-theme-muted">Odkaz na mapu</dt>
                  <dd>
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Google Maps
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            type="button"
            className="w-full"
            loading={saving || resolvingGps}
            onClick={() => void handleSave()}
          >
            <Check className="h-4 w-4" />
            Uložit fotografii
          </Button>

          {saving && (
            <p className="flex items-center justify-center gap-2 text-sm text-theme-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ukládám do galerie, mapy a stavebního bodu…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

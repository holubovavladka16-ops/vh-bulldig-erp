import { useEffect, useState, type ChangeEvent } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
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
import { geocodeFallbackAddress, formatGpsCoordinatesCompact } from '@/lib/photos/photoDisplay'
import { createGpsPhoto } from '@/lib/photos/api'
import { fetchJobOrders } from '@/lib/orders/api'
import type { GpsCaptureMetadata } from '@/lib/photos/gpsCapture'
import { toCaptureMetadata } from '@/lib/photos/gpsCapture'
import type { GeocodedAddress } from '@/types/photos'

type CapturePhase = 'camera' | 'save'

interface CapturedSnapshot {
  file: File
  previewUrl: string
  gps: GpsCaptureMetadata
  address: GeocodedAddress
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
  const [error, setError] = useState('')

  const gps = useGpsPreflight(active)
  const camera = useCameraStream({ enabled: active && phase === 'camera' })

  const canTakePhoto = camera.isActive && !saving

  useEffect(() => {
    if (!active) return
    setPhase('camera')
    setSnapshot(null)
    setNote('')
    setOrderId(defaultOrderId ?? '')
    setError('')
    setSaving(false)

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

  async function takeSnapshot(file: File) {
    const currentPosition = gps.position
    const gpsMeta = toCaptureMetadata(currentPosition, {
      fromCache: gps.positionFromCache,
      source: gps.positionFromCache ? 'cache' : currentPosition ? 'high_accuracy' : 'unavailable',
    })

    const resolvedAddress = currentPosition
      ? gps.address ?? geocodeFallbackAddress(currentPosition.lat, currentPosition.lng)
      : {
          address_full: 'GPS nedostupná',
          street: '',
          city: '',
          postal_code: '',
          country: '',
        }

    const previewUrl = URL.createObjectURL(file)

    setSnapshot({
      file,
      previewUrl,
      gps: gpsMeta,
      address: resolvedAddress,
      capturedAt: new Date(),
      deviceHeading: getDeviceOrientation() ?? currentPosition?.heading ?? null,
    })
    setPhase('save')
    setError('')
    camera.stop()
  }

  async function handleCameraCapture() {
    if (!canTakePhoto) return
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

  function resolveGpsForSave(): GpsCaptureMetadata {
    if (!snapshot) {
      return toCaptureMetadata(null)
    }

    const latest = toCaptureMetadata(gps.position, {
      fromCache: gps.positionFromCache,
      source: gps.positionFromCache ? 'cache' : gps.position ? 'high_accuracy' : 'unavailable',
    })

    const snapshotAccuracy = snapshot.gps.accuracy ?? Number.POSITIVE_INFINITY
    const latestAccuracy = latest.accuracy ?? Number.POSITIVE_INFINITY

    if (latest.lat != null && latest.lng != null && latestAccuracy <= snapshotAccuracy) {
      return latest
    }

    return snapshot.gps
  }

  async function handleSave() {
    if (!snapshot) return
    if (!orderId) {
      setError('Vyberte zakázku.')
      return
    }

    setSaving(true)
    setError('')

    const gpsMeta = resolveGpsForSave()
    const resolvedAddress =
      gpsMeta.lat != null && gpsMeta.lng != null
        ? gps.address ?? geocodeFallbackAddress(gpsMeta.lat, gpsMeta.lng)
        : snapshot.address

    try {
      await createGpsPhoto(
        {
          file: snapshot.file,
          captured_at: snapshot.capturedAt,
          gps_lat: gpsMeta.lat,
          gps_lng: gpsMeta.lng,
          gps_accuracy: gpsMeta.accuracy,
          gps_obtained_at: gpsMeta.obtainedAt,
          gps_source: gpsMeta.source,
          gps_from_cache: gpsMeta.fromCache,
          device_heading: snapshot.deviceHeading,
          ...resolvedAddress,
          note,
          order_id: orderId,
          construction_point_id: constructionPointId ?? null,
        },
        uploadedBy
      )
      if (snapshot.previewUrl) URL.revokeObjectURL(snapshot.previewUrl)
      setSnapshot(null)
      setPhase('camera')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setSaving(false)
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
            <p className="text-sm text-theme-muted">GPS se zpřesňuje na pozadí – foto lze pořídit ihned</p>
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
                position={gps.position}
                address={gps.address}
                addressLoading={gps.addressLoading}
                error={gps.error}
                quality={gps.quality}
                qualityLabel={gps.qualityLabel}
                positionFromCache={gps.positionFromCache}
                refining={gps.refining}
                onRefine={gps.refineAccuracy}
              />
            </div>
          </div>

          <div className="photo-camera-actions">
            <button
              type="button"
              className={`photo-capture-btn photo-capture-btn--primary ${!canTakePhoto ? 'photo-capture-btn--disabled' : ''}`}
              disabled={!canTakePhoto}
              onClick={() => void handleCameraCapture()}
            >
              <Camera className="h-6 w-6" />
              Vyfotit
            </button>

            <label
              className={`photo-capture-btn photo-capture-btn--secondary ${!canTakePhoto ? 'photo-capture-btn--disabled' : ''}`}
            >
              <ImagePlus className="h-5 w-5" />
              Galerie
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!canTakePhoto}
                onChange={handleGalleryInput}
              />
            </label>
          </div>

          {gps.refining && (
            <p className="mt-2 text-center text-xs text-cyan-300">
              <Satellite className="mr-1 inline h-3.5 w-3.5" />
              GPS se zpřesňuje na pozadí ({gps.accuracyLabel}).
            </p>
          )}

          {gps.showLowAccuracyWarning && (
            <p className="mt-2 text-center text-xs text-amber-300">
              Nízká přesnost GPS – před uložením můžete polohu zpřesnit.
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
                  {snapshot.gps.lat != null && snapshot.gps.lng != null
                    ? formatGpsCoordinatesCompact(snapshot.gps.lat, snapshot.gps.lng)
                    : 'GPS nedostupná'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-theme-muted">Přesnost GPS</dt>
                <dd className="text-theme-primary">
                  {snapshot.gps.accuracy != null
                    ? formatGpsAccuracy(snapshot.gps.accuracy)
                    : '—'}
                  {snapshot.gps.quality !== 'unavailable' && (
                    <span className="ml-2 text-xs text-theme-muted">({gps.qualityLabel})</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <dt className="text-xs text-theme-muted">Adresa</dt>
                  <dd className="text-theme-primary">{snapshot.address.address_full}</dd>
                </div>
              </div>
            </dl>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="button" className="w-full" loading={saving} onClick={() => void handleSave()}>
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

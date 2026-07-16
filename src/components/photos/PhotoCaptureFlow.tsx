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
import type { GpsPositionState } from '@/lib/photos/gpsWatch'
import type { GeocodedAddress } from '@/types/photos'

type CapturePhase = 'camera' | 'save'

interface CapturedSnapshot {
  file: File
  previewUrl: string
  position: GpsPositionState
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

  const gps = useGpsPreflight(active && phase === 'camera')
  const camera = useCameraStream()

  const canCapture = gps.canCapture && !saving

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
    if (!gps.position) {
      setError('GPS poloha není připravena. Počkejte na zaměření.')
      return
    }

    const resolvedAddress = gps.address ?? geocodeFallbackAddress(gps.position.lat, gps.position.lng)
    const previewUrl = URL.createObjectURL(file)

    setSnapshot({
      file,
      previewUrl,
      position: { ...gps.position },
      address: resolvedAddress,
      capturedAt: new Date(),
      deviceHeading: getDeviceOrientation() ?? gps.position.heading ?? null,
    })
    setPhase('save')
    setError('')
    camera.stop()
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

  function handleStartCamera() {
    void camera.start()
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
    void camera.start()
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
      await createGpsPhoto(
        {
          file: snapshot.file,
          captured_at: snapshot.capturedAt,
          gps_lat: snapshot.position.lat,
          gps_lng: snapshot.position.lng,
          gps_accuracy: snapshot.position.accuracy,
          device_heading: snapshot.deviceHeading,
          ...snapshot.address,
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
            <p className="text-sm text-theme-muted">GPS se zaměřuje před vyfocením</p>
          </div>
        )}

        <div className="photo-camera-shell">
          <div className="photo-camera-viewport">
            <video
              ref={camera.videoRef}
              className="photo-camera-video"
              playsInline
              muted
              autoPlay
            />

            {!camera.isActive && camera.phase === 'starting' && (
              <div className="photo-camera-placeholder">
                <Loader2 className="h-10 w-10 animate-spin text-white/60" />
                <p className="mt-3 text-sm text-white/70">Spouštím fotoaparát…</p>
              </div>
            )}

            {!camera.isActive && camera.phase !== 'starting' && camera.error && (
              <div className="photo-camera-placeholder">
                <Camera className="h-12 w-12 text-white/40" />
                <p className="mt-3 text-sm text-red-300">{camera.error}</p>
                <button
                  type="button"
                  className="photo-capture-btn photo-capture-btn--secondary mt-4"
                  onClick={handleStartCamera}
                >
                  Zkusit znovu
                </button>
              </div>
            )}

            {!camera.isActive && camera.phase !== 'starting' && !camera.error && (
              <div className="photo-camera-placeholder">
                <Camera className="h-12 w-12 text-white/40" />
                <p className="mt-3 text-sm text-white/70">
                  Fotoaparát se spustí po udělení oprávnění.
                </p>
                <button
                  type="button"
                  className="photo-capture-btn photo-capture-btn--primary mt-4"
                  onClick={handleStartCamera}
                >
                  <Camera className="h-5 w-5" />
                  Spustit fotoaparát
                </button>
              </div>
            )}

            <div className="photo-camera-overlay">
              <GpsCameraOverlay
                phase={gps.phase}
                position={gps.position}
                address={gps.address}
                addressLoading={gps.addressLoading}
                error={gps.error}
                onAcceptRelaxed={gps.acceptRelaxedAccuracy}
                onContinueSearching={gps.continueSearching}
              />
            </div>
          </div>

          <div className="photo-camera-actions">
            <button
              type="button"
              className={`photo-capture-btn photo-capture-btn--primary ${!canCapture || !camera.isActive ? 'photo-capture-btn--disabled' : ''}`}
              disabled={!canCapture || !camera.isActive}
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

            {!camera.isActive && camera.phase !== 'starting' && (
              <label
                className={`photo-capture-btn photo-capture-btn--secondary ${!canCapture ? 'photo-capture-btn--disabled' : ''}`}
              >
                <Camera className="h-5 w-5" />
                Fotoaparát (záložní)
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={!canCapture}
                  onChange={handleGalleryInput}
                />
              </label>
            )}
          </div>

          {!canCapture && (
            <p className="mt-2 text-center text-xs text-amber-300">
              <Satellite className="mr-1 inline h-3.5 w-3.5" />
              Tlačítko Vyfotit se aktivuje po načtení GPS polohy a adresy.
            </p>
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
                  {formatGpsCoordinatesCompact(snapshot.position.lat, snapshot.position.lng)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-theme-muted">Přesnost GPS</dt>
                <dd className="text-theme-primary">
                  {formatGpsAccuracy(snapshot.position.accuracy)}
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

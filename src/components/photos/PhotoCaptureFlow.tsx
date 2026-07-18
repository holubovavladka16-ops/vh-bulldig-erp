import { useEffect, useRef, useState, type ChangeEvent } from 'react'
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
import { CameraVideoPreview } from '@/components/photos/CameraVideoPreview'
import { PhotoLocationPreview } from '@/components/photos/PhotoLocationPreview'
import { GpsCameraOverlay } from '@/components/photos/GpsCameraOverlay'
import { useGpsPreflight } from '@/hooks/useGpsPreflight'
import { isTouchDevice, useCameraStream } from '@/hooks/useCameraStream'
import { getDeviceOrientation } from '@/lib/photos/gpsWatch'
import { formatGpsCoordinatesCompact } from '@/lib/photos/photoDisplay'
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
  /** Registrace start() pro spuštění kamery ze stejného user-gesture (např. tlačítko Focení). */
  onRegisterCameraStart?: (start: () => Promise<void>) => void
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
  onRegisterCameraStart,
}: PhotoCaptureFlowProps) {
  const [phase, setPhase] = useState<CapturePhase>('camera')
  const [snapshot, setSnapshot] = useState<CapturedSnapshot | null>(null)
  const [orderId, setOrderId] = useState('')
  const [note, setNote] = useState('')
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')
  const capturingRef = useRef(false)

  const gps = useGpsPreflight(active && phase === 'camera')
  const camera = useCameraStream({ enabled: active && phase === 'camera' })

  const gpsReady = gps.canCapture && !saving
  const cameraReady = camera.canCapture
  const canShoot = gpsReady && cameraReady && !capturing
  const showGpsOverlay = !camera.needsUserStart
  const showNativeCamera =
    isTouchDevice() &&
    (camera.needsUserStart ||
      camera.phase === 'denied' ||
      camera.phase === 'unavailable' ||
      (gpsReady && !camera.canCapture))

  useEffect(() => {
    onRegisterCameraStart?.(camera.start)
  }, [camera.start, onRegisterCameraStart])

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

    const resolvedAddress = gps.resolveAddressForCapture()
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
    if (capturingRef.current) return

    if (!gps.position) {
      setError('GPS poloha není připravena. Počkejte na zaměření.')
      return
    }
    if (!gps.canCapture) {
      setError('Počkejte na GPS zaměření nebo klepněte „Focení povolit“.')
      return
    }

    capturingRef.current = true
    setCapturing(true)
    setError('')

    try {
      const result = await camera.captureFrame()
      if (!result.file) {
        setError(result.error?.message ?? 'Snímek se nepodařilo pořídit.')
        return
      }
      await takeSnapshot(result.file)
    } finally {
      capturingRef.current = false
      setCapturing(false)
    }
  }

  function handleGalleryInput(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (selected) void takeSnapshot(selected)
  }

  function handleNativeCameraInput(e: ChangeEvent<HTMLInputElement>) {
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
            <CameraVideoPreview
              setVideoRef={camera.setVideoRef}
              phase={camera.phase}
              isStreamReady={camera.isStreamReady}
              errorMessage={camera.errorMessage}
              needsUserStart={camera.needsUserStart}
              onStart={() => void camera.start()}
              diagnostics={camera.diagnostics}
            />

            {showGpsOverlay && (
              <div className="photo-camera-overlay">
                <GpsCameraOverlay
                  phase={gps.phase}
                  position={gps.position}
                  address={gps.address}
                  addressStatus={gps.addressStatus}
                  error={gps.error}
                  onAcceptRelaxed={gps.acceptRelaxedAccuracy}
                  onContinueSearching={gps.continueSearching}
                />
              </div>
            )}
          </div>

          <div className="photo-camera-actions">
            {camera.needsUserStart && (
              <button
                type="button"
                className="photo-capture-btn photo-capture-btn--primary"
                onClick={() => void camera.start()}
              >
                <Camera className="h-6 w-6" />
                Spustit kameru
              </button>
            )}

            <button
              type="button"
              className={`photo-capture-btn photo-capture-btn--primary ${!canShoot && !capturing ? 'photo-capture-btn--disabled' : ''} ${capturing ? 'photo-capture-btn--busy' : ''}`}
              aria-disabled={capturing || undefined}
              onClick={() => void handleCameraCapture()}
            >
              {capturing ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Pořizuji…
                </>
              ) : (
                <>
                  <Camera className="h-6 w-6" />
                  Vyfotit
                </>
              )}
            </button>

            {showNativeCamera && (
              <label className="photo-capture-btn photo-capture-btn--secondary">
                <Camera className="h-5 w-5" />
                Systémový fotoaparát
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleNativeCameraInput}
                />
              </label>
            )}

            <label
              className={`photo-capture-btn photo-capture-btn--secondary ${!gpsReady ? 'photo-capture-btn--disabled' : ''}`}
            >
              <ImagePlus className="h-5 w-5" />
              Galerie
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!gpsReady}
                onChange={handleGalleryInput}
              />
            </label>
          </div>

          {!gpsReady && (
            <p className="mt-2 text-center text-xs text-amber-300">
              <Satellite className="mr-1 inline h-3.5 w-3.5" />
              Tlačítko Vyfotit se aktivuje po načtení GPS polohy a připravení kamery.
            </p>
          )}

          {gpsReady && camera.phase === 'active' && !camera.isStreamReady && !camera.needsUserStart && (
            <p className="mt-2 text-center text-xs text-amber-300">
              Čekám na živý náhled kamery…
            </p>
          )}

          {camera.errorMessage && (camera.phase === 'denied' || camera.phase === 'unavailable') && (
            <div className="mt-2 space-y-1 text-center text-xs">
              <p className="text-red-400">{camera.errorMessage}</p>
              <button type="button" className="text-sky-400 underline" onClick={camera.retry}>
                Zkusit kameru znovu
              </button>
            </div>
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
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-[var(--border-glass)] bg-black/40">
              <img
                src={snapshot.previewUrl}
                alt="Pořízená fotografie"
                className="max-h-[360px] w-full object-contain"
              />
            </div>
            <PhotoLocationPreview
              lat={snapshot.position.lat}
              lng={snapshot.position.lng}
              address={snapshot.address.address_full}
              accuracy={snapshot.position.accuracy}
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

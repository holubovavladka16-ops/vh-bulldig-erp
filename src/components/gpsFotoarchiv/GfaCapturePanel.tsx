import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, Crosshair, ImagePlus, Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { CameraVideoPreview } from '@/components/formCheck/CameraVideoPreview'
import { useCameraStream } from '@/hooks/useCameraStream'
import type { useGpsPreflight } from '@/hooks/useGpsPreflight'
import { GPS_FOTOARCHIV_MAX_ACCURACY_METERS } from '@/constants/gpsFotoarchiv'
import { formatGpsLocationLabel } from '@/lib/photos/photoDisplay'
import { getDeviceLabel, saveArchivePhoto } from '@/lib/gpsFotoarchiv/service'
import { fetchReportOptions } from '@/lib/photos/api'
import type { GeocodedAddress } from '@/types/photos'
import '@/styles/photoMap.css'

type GpsState = ReturnType<typeof useGpsPreflight>

interface GfaCapturePanelProps {
  userId: string
  orderOptions: { value: string; label: string }[]
  onSaved: () => void
  gps: GpsState
  locationArmed: boolean
  onArmLocation: () => void
  onResetLocation: () => void
}

interface CaptureSnapshot {
  capturedAt: Date
  gps_lat: number
  gps_lng: number
  gps_accuracy: number | null
  address: GeocodedAddress
}

type FlowPhase = 'locate' | 'capture' | 'preview'

export function GfaCapturePanel({
  userId,
  orderOptions,
  onSaved,
  gps,
  locationArmed,
  onArmLocation,
  onResetLocation,
}: GfaCapturePanelProps) {
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('locate')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [snapshot, setSnapshot] = useState<CaptureSnapshot | null>(null)
  const [orderId, setOrderId] = useState('')
  const [reportId, setReportId] = useState('')
  const [reportOptions, setReportOptions] = useState<{ value: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const capturingRef = useRef(false)

  const cameraEnabled = flowPhase === 'capture'
  const camera = useCameraStream({ enabled: cameraEnabled, facingMode: 'environment' })

  useEffect(() => {
    fetchReportOptions()
      .then(setReportOptions)
      .catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!locationArmed) {
      setFlowPhase('locate')
      return
    }
    if (gps.canCapture) {
      setFlowPhase((current) => (current === 'preview' ? current : 'capture'))
    }
  }, [gps.canCapture, locationArmed])

  function buildSnapshot(): CaptureSnapshot | null {
    if (!gps.position) return null
    return {
      capturedAt: new Date(),
      gps_lat: gps.position.lat,
      gps_lng: gps.position.lng,
      gps_accuracy: gps.position.accuracy,
      address: gps.resolveAddressForCapture(),
    }
  }

  function showPreview(file: File, snap: CaptureSnapshot) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setSnapshot(snap)
    setFlowPhase('preview')
    setError(null)
    camera.stop()
  }

  function resetAfterSave() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
    setSnapshot(null)
    setOrderId('')
    setReportId('')
    setFlowPhase('locate')
    onResetLocation()
  }

  function resetPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
    setSnapshot(null)
    setFlowPhase('capture')
    setError(null)
  }

  async function handleCameraCapture() {
    if (capturingRef.current || !gps.canCapture) return

    const snap = buildSnapshot()
    if (!snap) return

    capturingRef.current = true
    setCapturing(true)
    setError(null)

    try {
      if (camera.needsUserStart && !camera.isActive) {
        await camera.start()
      }

      const result = await camera.captureFrame()
      if (!result.file) {
        setError(result.error?.message ?? 'Snímek se nepodařilo pořídit.')
        return
      }

      showPreview(result.file, snap)
    } finally {
      capturingRef.current = false
      setCapturing(false)
    }
  }

  function handleNativeFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !gps.canCapture) return

    const snap = buildSnapshot()
    if (!snap) return
    showPreview(file, snap)
  }

  async function handleSave() {
    if (!previewFile || !snapshot) return
    if (!orderId) {
      setError('Vyberte zakázku.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await saveArchivePhoto(
        {
          file: previewFile,
          gps_lat: snapshot.gps_lat,
          gps_lng: snapshot.gps_lng,
          gps_accuracy: snapshot.gps_accuracy,
          address_full: snapshot.address.address_full,
          street: snapshot.address.street,
          city: snapshot.address.city,
          postal_code: snapshot.address.postal_code,
          country: snapshot.address.country,
          captured_at: snapshot.capturedAt,
          order_id: orderId,
          report_id: reportId || null,
          device_info: getDeviceLabel(),
        },
        userId
      )
      resetAfterSave()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  const accuracyLabel = gps.position
    ? formatGpsLocationLabel(gps.position.lat, gps.position.lng, gps.position.accuracy)
    : '—'

  if (flowPhase === 'preview' && previewUrl) {
    return (
      <Card className="space-y-4 p-4">
        <h3 className="text-lg font-semibold">Náhled a uložení</h3>
        <img src={previewUrl} alt="Náhled" className="max-h-72 w-full rounded-xl object-contain" />
        {snapshot && (
          <div className="rounded-xl border border-[var(--border-glass)] p-3 text-sm text-[var(--text-muted)]">
            <p>{snapshot.address.address_full}</p>
            <p className="mt-1 font-mono text-xs">{accuracyLabel}</p>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Select
          label="Zakázka *"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          options={[{ value: '', label: 'Vyberte zakázku' }, ...orderOptions]}
        />
        <Select
          label="Výkaz (volitelné)"
          value={reportId}
          onChange={(e) => setReportId(e.target.value)}
          options={[{ value: '', label: 'Bez propojení' }, ...reportOptions]}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleSave()} loading={saving} disabled={!orderId}>
            Uložit fotografii
          </Button>
          <Button variant="secondary" onClick={resetPreview}>
            Znovu vyfotit
          </Button>
        </div>
      </Card>
    )
  }

  if (!locationArmed) {
    return (
      <Card className="space-y-4 p-4">
        <p className="text-sm text-[var(--text-muted)]">
          Klepněte pro zaměření polohy. Po načtení adresy a souřadnic s přesností ±
          {GPS_FOTOARCHIV_MAX_ACCURACY_METERS} m se otevře možnost vyfotit a uložit.
        </p>

        <button
          type="button"
          onClick={onArmLocation}
          className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-amber-400/50 bg-amber-400/5 px-6 py-10 transition hover:border-amber-400 hover:bg-amber-400/10"
        >
          <Crosshair className="h-12 w-12 text-amber-400" />
          <span className="text-lg font-semibold text-[var(--text-primary)]">Zaměřit polohu dotykem</span>
          <span className="text-center text-sm text-[var(--text-muted)]">
            Spustí GPS, načte adresu a souřadnice
          </span>
        </button>
      </Card>
    )
  }

  if (flowPhase !== 'capture' && flowPhase !== 'preview') {
    return (
      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Zaměřuji polohu…
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Přesnost GPS</dt>
            <dd className={gps.accuracyReady ? 'font-medium text-emerald-400' : 'text-[var(--text-primary)]'}>
              {gps.position ? `±${Math.round(gps.position.accuracy)} m` : '—'}
              {gps.accuracyReady ? ' ✓' : ` (cíl ±${GPS_FOTOARCHIV_MAX_ACCURACY_METERS} m)`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Souřadnice</dt>
            <dd className="font-mono text-xs text-[var(--text-primary)]">
              {gps.position
                ? `${gps.position.lat.toFixed(6)}, ${gps.position.lng.toFixed(6)}`
                : 'Čekám…'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-[var(--text-muted)]">Adresa</dt>
            <dd className="text-[var(--text-primary)]">
              {gps.addressLoading ? (
                <span className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Načítám adresu…
                </span>
              ) : (
                gps.addressDisplayLabel
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-[var(--text-muted)]">Zařízení</dt>
            <dd className="text-[var(--text-primary)]">{getDeviceLabel()}</dd>
          </div>
        </dl>

        {gps.error && <p className="text-sm text-amber-300">{gps.error}</p>}

        <Button variant="ghost" size="sm" onClick={onResetLocation}>
          Zrušit zaměření
        </Button>
      </Card>
    )
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-emerald-300">
          <MapPin className="h-4 w-4" />
          Poloha zaměřena – můžete vyfotit
        </p>
        <p className="mt-1 text-[var(--text-muted)]">{gps.addressDisplayLabel}</p>
        <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">{accuracyLabel}</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="photo-camera-shell">
        <div className="photo-camera-viewport">
          <CameraVideoPreview
            setVideoRef={camera.setVideoRef}
            phase={camera.phase}
            isStreamReady={camera.isStreamReady}
            errorMessage={camera.errorMessage}
            needsUserStart={camera.needsUserStart}
            onStart={camera.start}
            diagnostics={camera.diagnostics}
          />
        </div>

        <div className="photo-camera-actions">
          <button
            type="button"
            className={`photo-capture-btn photo-capture-btn--primary ${capturing ? 'photo-capture-btn--disabled' : ''}`}
            disabled={capturing}
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

          <label className="photo-capture-btn photo-capture-btn--secondary">
            <ImagePlus className="h-5 w-5" />
            Nativní foťák
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleNativeFile}
            />
          </label>
        </div>

        {camera.errorMessage && (camera.phase === 'denied' || camera.phase === 'unavailable') && (
          <div className="space-y-1 text-center text-xs">
            <p className="text-red-400">{camera.errorMessage}</p>
            <button type="button" className="text-sky-400 underline" onClick={camera.retry}>
              Zkusit kameru znovu
            </button>
          </div>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onResetLocation}>
        Zaměřit znovu
      </Button>
    </Card>
  )
}

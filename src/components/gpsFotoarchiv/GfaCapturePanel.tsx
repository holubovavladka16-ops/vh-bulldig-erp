import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, ImagePlus, Loader2, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { CameraVideoPreview } from '@/components/formCheck/CameraVideoPreview'
import { useCameraStream } from '@/hooks/useCameraStream'
import { useGpsPreflight } from '@/hooks/useGpsPreflight'
import { GPS_TARGET_ACCURACY_METERS } from '@/lib/photos/geocoding'
import { formatGpsLocationLabel } from '@/lib/photos/photoDisplay'
import { getDeviceLabel, saveArchivePhoto } from '@/lib/gpsFotoarchiv/service'
import { fetchReportOptions } from '@/lib/photos/api'
import type { GeocodedAddress } from '@/types/photos'
import '@/styles/photoMap.css'

interface GfaCapturePanelProps {
  userId: string
  orderOptions: { value: string; label: string }[]
  onSaved: () => void
}

interface CaptureSnapshot {
  capturedAt: Date
  gps_lat: number
  gps_lng: number
  gps_accuracy: number | null
  address: GeocodedAddress
}

export function GfaCapturePanel({ userId, orderOptions, onSaved }: GfaCapturePanelProps) {
  const [phase, setPhase] = useState<'camera' | 'preview'>('camera')
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

  const gps = useGpsPreflight(true)
  const camera = useCameraStream({ enabled: phase === 'camera', facingMode: 'environment' })

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
    setPhase('preview')
    setError(null)
    camera.stop()
  }

  function resetPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
    setSnapshot(null)
    setPhase('camera')
    setError(null)
  }

  async function handleCameraCapture() {
    if (capturingRef.current) return

    if (!gps.canCapture || !gps.position) {
      setError(
        gps.position
          ? `GPS přesnost ±${Math.round(gps.position.accuracy)} m nedosahuje požadovaných ±${GPS_TARGET_ACCURACY_METERS} m. Klepněte na „Pokračovat s aktuální přesností“.`
          : 'Počkejte na zaměření polohy.'
      )
      return
    }

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
    if (!file) return

    if (!gps.canCapture || !gps.position) {
      setError('Nejdříve zaměřte polohu (GPS ±2 m nebo pokračujte s aktuální přesností).')
      return
    }

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
      resetPreview()
      setOrderId('')
      setReportId('')
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

  if (phase === 'preview' && previewUrl) {
    return (
      <Card className="space-y-4 p-4">
        <h3 className="text-lg font-semibold">Náhled fotografie</h3>
        <img src={previewUrl} alt="Náhled" className="max-h-72 w-full rounded-xl object-contain" />
        {snapshot && (
          <p className="text-sm text-[var(--text-muted)]">
            {snapshot.address.address_full} · {accuracyLabel}
          </p>
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

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <MapPin className="h-4 w-4 text-amber-400" />
          <span>
            {gps.accuracyReady
              ? `Poloha připravena (${accuracyLabel})`
              : gps.position
                ? `Zaměřování… ${accuracyLabel} (cíl ±${GPS_TARGET_ACCURACY_METERS} m)`
                : 'Čekám na GPS…'}
          </span>
        </div>
        {gps.phase === 'timeout_prompt' && (
          <Button size="sm" variant="secondary" onClick={gps.acceptRelaxedAccuracy}>
            Pokračovat s aktuální přesností
          </Button>
        )}
        {!gps.accuracyReady && gps.phase === 'waiting' && (
          <Button size="sm" variant="ghost" onClick={gps.continueSearching}>
            <RefreshCw className="h-4 w-4" />
            Hledat dál
          </Button>
        )}
      </div>

      <p className="text-sm text-[var(--text-muted)]">{gps.addressDisplayLabel}</p>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {gps.error && <p className="text-sm text-amber-300">{gps.error}</p>}

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
          <div className="photo-camera-overlay">
            <p className="text-center text-sm font-medium text-white drop-shadow">
              {gps.canCapture ? 'Kamera připravena k pořízení snímku' : 'Nejdříve zaměřte GPS polohu'}
            </p>
          </div>
        </div>

        <div className="photo-camera-actions">
          <button
            type="button"
            className={`photo-capture-btn photo-capture-btn--primary ${!gps.canCapture || capturing ? 'photo-capture-btn--disabled' : ''}`}
            disabled={!gps.canCapture || capturing}
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

          <label
            className={`photo-capture-btn photo-capture-btn--secondary ${!gps.canCapture ? 'photo-capture-btn--disabled' : ''}`}
          >
            <ImagePlus className="h-5 w-5" />
            Nativní foťák
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={!gps.canCapture}
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
    </Card>
  )
}

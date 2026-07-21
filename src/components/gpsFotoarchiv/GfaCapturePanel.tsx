import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, ImagePlus, Loader2, MapPin, Save } from 'lucide-react'
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
}

interface CaptureSnapshot {
  capturedAt: Date
  gps_lat: number
  gps_lng: number
  gps_accuracy: number | null
  address: GeocodedAddress
}

export function GfaCapturePanel({ userId, orderOptions, onSaved, gps }: GfaCapturePanelProps) {
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [orderId, setOrderId] = useState('')
  const [reportId, setReportId] = useState('')
  const [reportOptions, setReportOptions] = useState<{ value: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const capturingRef = useRef(false)
  const autoSaveAttemptedRef = useRef(false)

  const camera = useCameraStream({ enabled: !previewUrl, facingMode: 'environment' })

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

  async function persistPhoto(file: File, snap: CaptureSnapshot) {
    if (!orderId) {
      setPreviewFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      camera.stop()
      setError('Vyberte zakázku – fotografie čeká na uložení.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await saveArchivePhoto(
        {
          file,
          gps_lat: snap.gps_lat,
          gps_lng: snap.gps_lng,
          gps_accuracy: snap.gps_accuracy,
          address_full: snap.address.address_full,
          street: snap.address.street,
          city: snap.address.city,
          postal_code: snap.address.postal_code,
          country: snap.address.country,
          captured_at: snap.capturedAt,
          order_id: orderId,
          report_id: reportId || null,
          device_info: getDeviceLabel(),
        },
        userId
      )
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewFile(null)
      setPreviewUrl(null)
      autoSaveAttemptedRef.current = false
      onSaved()
    } catch (err) {
      autoSaveAttemptedRef.current = false
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!previewFile || !gps.canCapture || !orderId || saving) return
    if (autoSaveAttemptedRef.current) return

    const snap = buildSnapshot()
    if (!snap) return

    autoSaveAttemptedRef.current = true
    void persistPhoto(previewFile, snap)
  }, [previewFile, gps.canCapture, orderId, saving, gps.position, gps.address])

  async function handleCameraCapture() {
    if (capturingRef.current) return

    capturingRef.current = true
    setCapturing(true)
    setError(null)

    try {
      if (!camera.isActive) {
        const started = await camera.start()
        if (!started.ok) {
          setError(started.message)
          return
        }
      }

      try {
        await camera.waitForStreamReady(12000)
      } catch (waitErr) {
        setError(waitErr instanceof Error ? waitErr.message : 'Kamera není připravena.')
        return
      }

      let result = await camera.captureFrame()
      if (!result.file) {
        await new Promise((resolve) => window.setTimeout(resolve, 250))
        result = await camera.captureFrame()
      }

      if (!result.file) {
        setError(result.error?.message ?? 'Snímek se nepodařilo pořídit.')
        return
      }

      autoSaveAttemptedRef.current = false
      setPreviewFile(result.file)

      if (gps.canCapture) {
        const snap = buildSnapshot()
        if (snap) await persistPhoto(result.file, snap)
      } else {
        setPreviewUrl(URL.createObjectURL(result.file))
        setError(null)
        camera.stop()
      }
    } finally {
      capturingRef.current = false
      setCapturing(false)
    }
  }

  function handleNativeFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    autoSaveAttemptedRef.current = false
    setPreviewFile(file)

    if (gps.canCapture) {
      const snap = buildSnapshot()
      if (snap) void persistPhoto(file, snap)
    } else {
      setPreviewUrl(URL.createObjectURL(file))
      camera.stop()
    }
  }

  function resetCapture() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewFile(null)
    setPreviewUrl(null)
    autoSaveAttemptedRef.current = false
    setError(null)
  }

  const accuracyLabel = gps.position
    ? formatGpsLocationLabel(gps.position.lat, gps.position.lng, gps.position.accuracy)
    : '—'

  if (previewUrl && previewFile) {
    return (
      <Card className="space-y-4 p-4">
        <h3 className="text-lg font-semibold">
          {gps.canCapture ? 'Ukládám fotografii…' : 'Čekám na GPS…'}
        </h3>
        <img src={previewUrl} alt="Náhled" className="max-h-56 w-full rounded-xl object-contain" />

        {!gps.canCapture ? (
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Zaměřuji polohu (cíl ±{GPS_FOTOARCHIV_MAX_ACCURACY_METERS} m)…
          </div>
        ) : saving ? (
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Ukládám do archivu…
          </div>
        ) : null}

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--text-muted)]">Přesnost GPS</dt>
            <dd className={gps.accuracyReady ? 'text-emerald-400' : ''}>
              {gps.position ? `±${Math.round(gps.position.accuracy)} m` : '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-[var(--text-muted)]">Adresa</dt>
            <dd>{gps.addressDisplayLabel}</dd>
          </div>
        </dl>

        <Select
          label="Zakázka *"
          value={orderId}
          onChange={(e) => {
            setOrderId(e.target.value)
            autoSaveAttemptedRef.current = false
          }}
          options={[{ value: '', label: 'Vyberte zakázku' }, ...orderOptions]}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button variant="secondary" onClick={resetCapture} disabled={saving}>
          Zrušit a vyfotit znovu
        </Button>
      </Card>
    )
  }

  return (
    <Card className="space-y-4 p-4">
      <p className="text-sm text-[var(--text-muted)]">
        1. Foťák je otevřený · 2. GPS zaměřuje polohu · 3. Při ±{GPS_FOTOARCHIV_MAX_ACCURACY_METERS} m se
        fotografie uloží
      </p>

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
          <div className="photo-camera-overlay pointer-events-none">
            <div
              className={`rounded-lg px-3 py-2 text-center text-sm font-medium ${
                gps.canCapture
                  ? 'bg-emerald-500/80 text-white'
                  : 'bg-black/60 text-white'
              }`}
            >
              {gps.canCapture ? (
                <span className="flex items-center justify-center gap-2">
                  <MapPin className="h-4 w-4" />
                  GPS ±{Math.round(gps.position?.accuracy ?? 0)} m – můžete uložit
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Zaměřuji… {gps.position ? `±${Math.round(gps.position.accuracy)} m` : ''}
                </span>
              )}
            </div>
            <p className="mt-2 truncate text-center text-xs text-white/90 drop-shadow">
              {gps.addressLoading ? 'Načítám adresu…' : gps.addressDisplayLabel}
            </p>
          </div>
        </div>

        <div className="photo-camera-actions">
          <button
            type="button"
            className={`photo-capture-btn photo-capture-btn--primary ${capturing ? 'photo-capture-btn--busy' : ''}`}
            aria-disabled={capturing || undefined}
            onClick={() => void handleCameraCapture()}
          >
            {capturing ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                {camera.needsUserStart && !camera.isActive ? 'Spouštím kameru…' : 'Pořizuji…'}
              </>
            ) : camera.needsUserStart && !camera.isActive ? (
              <>
                <Camera className="h-6 w-6" />
                Spustit kameru a vyfotit
              </>
            ) : !camera.isStreamReady && camera.isActive ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Připravuji náhled…
              </>
            ) : gps.canCapture ? (
              <>
                <Save className="h-6 w-6" />
                Vyfotit a uložit
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

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        {camera.errorMessage && (camera.phase === 'denied' || camera.phase === 'unavailable') && (
          <div className="space-y-1 text-center text-xs">
            <p className="text-red-400">{camera.errorMessage}</p>
            <button type="button" className="text-sky-400 underline" onClick={camera.retry}>
              Zkusit kameru znovu
            </button>
          </div>
        )}
      </div>

      <dl className="grid gap-2 rounded-xl border border-[var(--border-glass)] p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[var(--text-muted)]">Souřadnice</dt>
          <dd className="font-mono text-xs">
            {gps.position
              ? `${gps.position.lat.toFixed(6)}, ${gps.position.lng.toFixed(6)}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--text-muted)]">Přesnost</dt>
          <dd className={gps.accuracyReady ? 'text-emerald-400' : ''}>{accuracyLabel}</dd>
        </div>
      </dl>

      {gps.error && <p className="text-sm text-amber-300">{gps.error}</p>}
    </Card>
  )
}

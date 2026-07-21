import { useState } from 'react'
import { Camera, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { useCameraStream } from '@/hooks/useCameraStream'
import { useGpsPreflight } from '@/hooks/useGpsPreflight'
import { GPS_TARGET_ACCURACY_METERS } from '@/lib/photos/geocoding'
import { formatGpsLocationLabel } from '@/lib/photos/photoDisplay'
import { getDeviceLabel, saveArchivePhoto } from '@/lib/gpsFotoarchiv/service'
import { fetchReportOptions } from '@/lib/photos/api'
import { useEffect } from 'react'

interface GfaCapturePanelProps {
  userId: string
  orderOptions: { value: string; label: string }[]
  onSaved: () => void
}

export function GfaCapturePanel({ userId, orderOptions, onSaved }: GfaCapturePanelProps) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [orderId, setOrderId] = useState('')
  const [reportId, setReportId] = useState('')
  const [reportOptions, setReportOptions] = useState<{ value: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const gps = useGpsPreflight(true)
  const camera = useCameraStream({ enabled: cameraOpen })

  useEffect(() => {
    fetchReportOptions()
      .then(setReportOptions)
      .catch(() => {})
  }, [])

  async function handleCapture() {
    setError(null)
    if (!gps.canCapture || !gps.position) {
      setError('Počkejte na zaměření polohy s přesností ±2 m.')
      return
    }
    if (!cameraOpen) {
      setCameraOpen(true)
      if (camera.needsUserStart) {
        await camera.start()
      }
      return
    }
    const result = await camera.captureFrame()
    if (result.error || !result.file) {
      setError(result.error?.message ?? 'Snímek se nepodařilo pořídit.')
      return
    }
    setPreviewFile(result.file)
    setPreviewUrl(URL.createObjectURL(result.file))
    camera.stop()
    setCameraOpen(false)
  }

  async function handleSave() {
    if (!previewFile || !gps.position) return
    if (!orderId) {
      setError('Vyberte zakázku.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const address = gps.resolveAddressForCapture()
      await saveArchivePhoto(
        {
          file: previewFile,
          gps_lat: gps.position.lat,
          gps_lng: gps.position.lng,
          gps_accuracy: gps.position.accuracy,
          address_full: address.address_full,
          street: address.street,
          city: address.city,
          postal_code: address.postal_code,
          country: address.country,
          captured_at: new Date(),
          order_id: orderId,
          report_id: reportId || null,
          device_info: getDeviceLabel(),
        },
        userId
      )
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setPreviewFile(null)
      setOrderId('')
      setReportId('')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  function resetPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
  }

  const accuracyLabel = gps.position
    ? formatGpsLocationLabel(gps.position.lat, gps.position.lng, gps.position.accuracy)
    : '—'

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
        {!gps.accuracyReady && gps.phase === 'timeout_prompt' && (
          <Button size="sm" variant="secondary" onClick={gps.continueSearching}>
            <RefreshCw className="h-4 w-4" />
            Hledat dál
          </Button>
        )}
      </div>

      <p className="text-sm text-[var(--text-muted)]">{gps.addressDisplayLabel}</p>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {gps.error && <p className="text-sm text-amber-300">{gps.error}</p>}

      {!previewUrl ? (
        <div className="space-y-3">
          {cameraOpen && (
            <div className="overflow-hidden rounded-xl border border-[var(--border-glass)] bg-black">
              <video
                ref={camera.setVideoRef}
                className="aspect-[4/3] w-full object-cover"
                playsInline
                muted
                autoPlay
              />
            </div>
          )}
          <Button
            onClick={() => void handleCapture()}
            disabled={!gps.canCapture || camera.phase === 'starting'}
            loading={camera.phase === 'starting'}
            className="w-full"
          >
            <Camera className="h-5 w-5" />
            {cameraOpen ? 'Vyfotit' : 'Spustit kameru a vyfotit'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <img src={previewUrl} alt="Náhled" className="max-h-72 w-full rounded-xl object-contain" />
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
              Zrušit
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

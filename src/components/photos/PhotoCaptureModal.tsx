import { useEffect, useState } from 'react'
import { Camera, ImagePlus, Loader2, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import {
  GPS_TARGET_ACCURACY_METERS,
  captureHighAccuracyPosition,
  reverseGeocode,
} from '@/lib/photos/geocoding'
import { createGpsPhoto, fetchReportOptions } from '@/lib/photos/api'
import { fetchJobOrders } from '@/lib/orders/api'
import { fetchWorkers } from '@/lib/workers/api'
import { formatDateFromDate, formatTime } from '@/constants/workers'
import type { GeocodedAddress } from '@/types/photos'

interface PhotoCaptureModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  uploadedBy: string
}

const emptyLinks = {
  order_id: '',
  worker_id: '',
  report_id: '',
}

export function PhotoCaptureModal({ open, onClose, onCreated, uploadedBy }: PhotoCaptureModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [capturedAt, setCapturedAt] = useState<Date | null>(null)
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null)
  const [gpsProgress, setGpsProgress] = useState<number | null>(null)
  const [address, setAddress] = useState<GeocodedAddress | null>(null)
  const [note, setNote] = useState('')
  const [links, setLinks] = useState(emptyLinks)
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [workerOptions, setWorkerOptions] = useState<{ value: string; label: string }[]>([])
  const [reportOptions, setReportOptions] = useState<{ value: string; label: string }[]>([])
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setPreviewUrl(null)
    setFile(null)
    setCapturedAt(null)
    setGps(null)
    setGpsProgress(null)
    setAddress(null)
    setNote('')
    setLinks(emptyLinks)
    setError('')

    Promise.all([
      fetchJobOrders().then((orders) => orders.map((o) => ({ value: o.id, label: o.name }))),
      fetchWorkers('aktivni').then((workers) =>
        workers.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` }))
      ),
      fetchReportOptions(),
    ]).then(([orders, workers, reports]) => {
      setOrderOptions([{ value: '', label: '— Bez zakázky —' }, ...orders])
      setWorkerOptions([{ value: '', label: '— Bez uživatele —' }, ...workers])
      setReportOptions([{ value: '', label: '— Bez výkazu —' }, ...reports])
    })
  }, [open])

  if (!open) return null

  async function captureGps() {
    setError('')
    setLoadingMeta(true)
    setGps(null)
    setGpsProgress(null)
    setAddress(null)

    try {
      const result = await captureHighAccuracyPosition((accuracy) => setGpsProgress(accuracy))
      setGps({ lat: result.lat, lng: result.lng, accuracy: result.accuracy })
      setAddress(await reverseGeocode(result.lat, result.lng))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GPS nebo adresa se nepodařily načíst.')
    } finally {
      setLoadingMeta(false)
      setGpsProgress(null)
    }
  }

  async function processFile(selected: File) {
    setError('')
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setCapturedAt(new Date())
    await captureGps()
  }

  async function handleSave() {
    if (!file || !capturedAt || !gps || !address) {
      setError('Nejdříve pořiďte fotografii a počkejte na GPS polohu s přesností ±2 m.')
      return
    }

    if (gps.accuracy != null && gps.accuracy > GPS_TARGET_ACCURACY_METERS) {
      setError(`GPS přesnost ±${Math.round(gps.accuracy)} m nesplňuje požadavek ±${GPS_TARGET_ACCURACY_METERS} m.`)
      return
    }

    setSaving(true)
    setError('')
    try {
      await createGpsPhoto(
        {
          file,
          captured_at: capturedAt,
          gps_lat: gps.lat,
          gps_lng: gps.lng,
          gps_accuracy: gps.accuracy,
          ...address,
          note,
          order_id: links.order_id || null,
          worker_id: links.worker_id || null,
          report_id: links.report_id || null,
        },
        uploadedBy
      )
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  const gpsReady =
    gps != null &&
    address != null &&
    (gps.accuracy == null || gps.accuracy <= GPS_TARGET_ACCURACY_METERS)

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-lg glass-panel neon-border scrollbar-premium">
        <h2 className="mb-2 text-xl font-bold text-theme-primary">Nová fotografie s GPS</h2>
        <p className="mb-6 text-sm text-theme-muted">
          Po výběru fotografie se automaticky uloží datum, čas, adresa, zakázka a poznámka.
          Požadovaná přesnost GPS: ±{GPS_TARGET_ACCURACY_METERS} m.
        </p>

        <div className="mb-6 flex flex-wrap gap-3">
          <label className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl btn-neon px-4 py-3 text-sm sm:flex-none">
            <Camera className="h-4 w-4" />
            Vyfotit
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            />
          </label>
          <label className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl btn-neon px-4 py-3 text-sm sm:flex-none">
            <ImagePlus className="h-4 w-4" />
            Galerie
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            />
          </label>
        </div>

        {previewUrl && (
          <img
            src={previewUrl}
            alt="Náhled"
            className="mb-4 max-h-52 w-full rounded-xl object-contain neon-border sm:max-h-64"
          />
        )}

        {loadingMeta && (
          <div className="mb-4 space-y-2 rounded-xl border border-[var(--border-glass)] p-4">
            <div className="flex items-center gap-2 text-sm text-theme-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Získávám přesnou GPS polohu…
            </div>
            {gpsProgress != null && (
              <p className="text-sm text-theme-muted">
                Aktuální přesnost: ±{Math.round(gpsProgress)} m (cíl ±{GPS_TARGET_ACCURACY_METERS} m)
              </p>
            )}
          </div>
        )}

        {gps && address && capturedAt && (
          <div className="neon-border mb-6 grid gap-3 rounded-xl p-4 sm:grid-cols-2">
            <Meta label="Datum pořízení" value={formatDateFromDate(capturedAt)} />
            <Meta label="Čas pořízení" value={formatTime(capturedAt)} />
            <Meta label="GPS" value={`${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`} />
            <Meta
              label="Přesnost"
              value={
                gps.accuracy != null
                  ? `±${Math.round(gps.accuracy)} m${gps.accuracy <= GPS_TARGET_ACCURACY_METERS ? ' ✓' : ''}`
                  : '—'
              }
            />
            <Meta label="Adresa" value={address.address_full} className="sm:col-span-2" />
            <Meta label="Ulice" value={address.street || '—'} />
            <Meta label="Město" value={address.city || '—'} />
          </div>
        )}

        {file && !loadingMeta && !gpsReady && (
          <div className="mb-4">
            <Button type="button" variant="secondary" onClick={captureGps}>
              <RefreshCw className="h-4 w-4" />
              Znovu načíst GPS
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Zakázka"
            options={orderOptions}
            value={links.order_id}
            onChange={(e) => setLinks({ ...links, order_id: e.target.value })}
          />
          <Select
            label="Uživatel"
            options={workerOptions}
            value={links.worker_id}
            onChange={(e) => setLinks({ ...links, worker_id: e.target.value })}
          />
          <Select
            label="Denní výkaz"
            options={reportOptions}
            value={links.report_id}
            onChange={(e) => setLinks({ ...links, report_id: e.target.value })}
            className="sm:col-span-2"
          />
          <Textarea
            label="Poznámka"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="sm:col-span-2"
          />
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Zrušit
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!file || !gpsReady}
            className="w-full sm:w-auto"
          >
            <MapPin className="h-4 w-4" />
            Uložit fotografii
          </Button>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="text-sm font-medium text-theme-primary">{value}</p>
    </div>
  )
}

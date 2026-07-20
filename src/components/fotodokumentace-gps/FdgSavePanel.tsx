import { useEffect, useState } from 'react'
import { Loader2, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FDG_GPS_UNVERIFIED_LABEL } from '@/constants/fotodokumentaceGps'
import { EMPTY_LOCATION, loadPhotoLocation } from '@/lib/fotodokumentace-gps/geolocation'
import { saveModulePhoto } from '@/lib/fotodokumentace-gps/service'
import { getPhotoMapLinks } from '@/lib/fotodokumentace-gps/share'
import { fetchJobOrders } from '@/lib/orders/api'
import { fetchWorkers } from '@/lib/workers/api'
import type { FdgLocationDraft, FdgPendingCapture } from '@/types/fotodokumentaceGps'

interface FdgSavePanelProps {
  capture: FdgPendingCapture
  userId: string
  presetOrderId?: string
  onSaved: () => void
  onCancel: () => void
}

export function FdgSavePanel({ capture, userId, presetOrderId, onSaved, onCancel }: FdgSavePanelProps) {
  const [location, setLocation] = useState<FdgLocationDraft>({ ...EMPTY_LOCATION, loading: true })
  const [orderId, setOrderId] = useState(presetOrderId ?? '')
  const [workerId, setWorkerId] = useState('')
  const [note, setNote] = useState('')
  const [addressEdit, setAddressEdit] = useState('')
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [workerOptions, setWorkerOptions] = useState<{ value: string; label: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const exifCoords =
      capture.exifLat != null && capture.exifLng != null
        ? { lat: capture.exifLat, lng: capture.exifLng }
        : null
    void loadPhotoLocation(
      (acc) => setLocation((l) => ({ ...l, accuracy: acc, loading: true })),
      exifCoords
    ).then((result) => {
      setLocation(result)
      setAddressEdit(result.address_full)
    })
  }, [capture])

  useEffect(() => {
    void fetchJobOrders().then((orders) =>
      setOrderOptions([{ value: '', label: '— Vyberte zakázku —' }, ...orders.map((o) => ({ value: o.id, label: o.name }))])
    )
    void fetchWorkers('vse').then((workers) =>
      setWorkerOptions([
        { value: '', label: '— Autor —' },
        ...workers.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` })),
      ])
    )
  }, [])

  async function retryGps() {
    setLocation({ ...EMPTY_LOCATION, loading: true })
    const result = await loadPhotoLocation((acc) => setLocation((l) => ({ ...l, accuracy: acc, loading: true })))
    setLocation(result)
    setAddressEdit(result.address_full)
  }

  async function handleSave(withoutGps = false) {
    if (!orderId) {
      setError('Vyberte zakázku.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await saveModulePhoto(
        capture.file,
        {
          order_id: orderId,
          worker_id: workerId || null,
          note,
          gps_lat: withoutGps ? null : location.lat,
          gps_lng: withoutGps ? null : location.lng,
          gps_accuracy: withoutGps ? null : location.accuracy,
          gps_verified: !withoutGps && location.gpsVerified,
          address_full: addressEdit.trim() || location.address_full,
          street: location.street,
          city: location.city,
          postal_code: location.postal_code,
          district: location.district,
          region: location.region,
          country: location.country,
          captured_at: capture.capturedAt.toISOString(),
        },
        userId
      )
      URL.revokeObjectURL(capture.previewUrl)
      if ('offline' in result) {
        setError('Fotografie uložena offline – synchronizuje se po připojení k internetu.')
        setTimeout(onSaved, 1200)
        return
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.')
    } finally {
      setBusy(false)
    }
  }

  const mapLinks =
    location.lat != null && location.lng != null
      ? getPhotoMapLinks({ gps_lat: location.lat, gps_lng: location.lng } as never)
      : null

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-glass)] p-4">
      <img src={capture.previewUrl} alt="" className="max-h-48 w-full rounded-xl object-contain" />

      <div className="rounded-xl bg-white/5 p-3 text-sm">
        {location.loading ? (
          <p className="flex items-center gap-2 text-theme-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Načítám GPS polohu…
          </p>
        ) : location.gpsVerified ? (
          <p className="text-green-400">Poloha byla načtena</p>
        ) : (
          <p className="text-amber-400">{FDG_GPS_UNVERIFIED_LABEL}</p>
        )}
        {location.lat != null && location.lng != null && (
          <p className="mt-1 font-mono text-xs text-theme-muted">
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            {location.accuracy != null ? ` (±${Math.round(location.accuracy)} m)` : ''}
          </p>
        )}
        {location.error && <p className="mt-1 text-red-400">{location.error}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={retryGps}>
            <RefreshCw className="h-4 w-4" />
            Zkusit znovu
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleSave(true)} disabled={busy}>
            Uložit bez GPS
          </Button>
        </div>
      </div>

      <Textarea label="Adresa" value={addressEdit} onChange={(e) => setAddressEdit(e.target.value)} rows={2} />

      {mapLinks && (
        <div className="flex flex-wrap gap-3 text-sm">
          <a href={mapLinks.mapy} target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] underline">
            Mapy.cz
          </a>
          <a href={mapLinks.google} target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] underline">
            Google Maps
          </a>
          <a href={mapLinks.street} target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] underline">
            Street View
          </a>
        </div>
      )}

      <Select label="Zakázka *" value={orderId} onChange={(e) => setOrderId(e.target.value)} options={orderOptions} />
      <Select label="Zaměstnanec" value={workerId} onChange={(e) => setWorkerId(e.target.value)} options={workerOptions} />
      <Textarea label="Popis prací / poznámka" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => handleSave(false)} disabled={busy || !orderId}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          Uložit fotografii
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Zrušit
        </Button>
      </div>
    </div>
  )
}

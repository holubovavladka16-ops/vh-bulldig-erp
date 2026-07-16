import { useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { captureCurrentPosition, reverseGeocode } from '@/lib/photos/geocoding'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  MAX_PHOTOS_PER_PHASE,
  PHOTO_PHASE_LABELS,
  type ConnectionGpsPhoto,
  type ConnectionPhotoPhase,
  type PendingConnectionPhoto,
} from '@/types/pripojky'
import { formatDate, formatDateFromDate, formatTime } from '@/constants/workers'

interface ConnectionPhotoCaptureProps {
  pendingPhotos: PendingConnectionPhoto[]
  existingPhotos?: ConnectionGpsPhoto[]
  onChange: (photos: PendingConnectionPhoto[]) => void
}

export function ConnectionPhotoCapture({ pendingPhotos, existingPhotos = [], onChange }: ConnectionPhotoCaptureProps) {
  const [loadingPhase, setLoadingPhase] = useState<ConnectionPhotoPhase | null>(null)
  const [error, setError] = useState('')

  function countPhase(phase: ConnectionPhotoPhase): number {
    const existing = existingPhotos.filter((p) => p.photo_phase === phase).length
    const pending = pendingPhotos.filter((p) => p.phase === phase).length
    return existing + pending
  }

  async function processFile(file: File, phase: ConnectionPhotoPhase) {
    if (countPhase(phase) >= MAX_PHOTOS_PER_PHASE) {
      setError(`Maximálně ${MAX_PHOTOS_PER_PHASE} fotografie pro fázi „${PHOTO_PHASE_LABELS[phase]}“.`)
      return
    }

    setError('')
    setLoadingPhase(phase)
    try {
      const position = await captureCurrentPosition()
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const address = await reverseGeocode(lat, lng)
      onChange([
        ...pendingPhotos,
        {
          file,
          captured_at: new Date(),
          gps_lat: lat,
          gps_lng: lng,
          gps_accuracy: position.coords.accuracy,
          phase,
          ...address,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotografii se nepodařilo zpracovat.')
    } finally {
      setLoadingPhase(null)
    }
  }

  function removePending(index: number) {
    onChange(pendingPhotos.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-theme-muted">
        Maximálně 4 fotografie celkem (2× před zahájením, 2× po dokončení). Pořízení pouze v aplikaci s GPS.
      </p>

      {(['pred', 'po'] as ConnectionPhotoPhase[]).map((phase) => (
        <div key={phase} className="neon-border rounded-xl p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-theme-primary">{PHOTO_PHASE_LABELS[phase]}</p>
            <p className="text-xs text-theme-muted">{countPhase(phase)}/{MAX_PHOTOS_PER_PHASE}</p>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl btn-neon px-3 py-2 text-sm">
            <Camera className="h-4 w-4" />
            Vyfotit
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={countPhase(phase) >= MAX_PHOTOS_PER_PHASE}
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], phase)}
            />
          </label>

          {loadingPhase === phase && (
            <div className="mt-2 flex items-center gap-2 text-sm text-theme-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Načítám GPS a adresu…
            </div>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {existingPhotos
              .filter((p) => p.photo_phase === phase)
              .map((photo) => (
                <PhotoCard
                  key={photo.id}
                  src={getGpsPhotoUrl(photo.file_path)}
                  date={formatDate(photo.captured_date)}
                  time={formatTime(photo.captured_time)}
                  address={photo.address_full}
                />
              ))}
            {pendingPhotos.map((photo, index) =>
              photo.phase === phase ? (
                <div key={`pending-${phase}-${index}`}>
                  <PhotoCard
                    src={URL.createObjectURL(photo.file)}
                    date={formatDateFromDate(photo.captured_at)}
                    time={formatTime(photo.captured_at)}
                    address={photo.address_full}
                  />
                  <Button variant="danger" size="sm" className="mt-2" onClick={() => removePending(index)}>
                    <Trash2 className="h-4 w-4" />
                    Odebrat
                  </Button>
                </div>
              ) : null
            )}
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}

function PhotoCard({ src, date, time, address }: { src: string; date: string; time: string; address: string }) {
  return (
    <div>
      <img src={src} alt="" className="max-h-32 w-full rounded-lg object-cover" />
      <p className="mt-1 text-xs text-theme-primary">{date} · {time}</p>
      <p className="text-xs text-theme-muted">{address}</p>
    </div>
  )
}

export function validateConnectionPhotos(
  pending: PendingConnectionPhoto[],
  existing: ConnectionGpsPhoto[] = []
): string | null {
  for (const phase of ['pred', 'po'] as ConnectionPhotoPhase[]) {
    const count =
      existing.filter((p) => p.photo_phase === phase).length +
      pending.filter((p) => p.phase === phase).length
    if (count > MAX_PHOTOS_PER_PHASE) {
      return `Maximálně ${MAX_PHOTOS_PER_PHASE} fotografie pro fázi „${PHOTO_PHASE_LABELS[phase]}“.`
    }
  }
  const total = existing.length + pending.length
  if (total > MAX_PHOTOS_PER_PHASE * 2) return 'Maximálně 4 fotografie celkem.'
  return null
}

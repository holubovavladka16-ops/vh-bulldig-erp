import { useState } from 'react'
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { captureCurrentPosition, reverseGeocode } from '@/lib/photos/geocoding'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import type { PendingDiaryPhoto } from '@/types/diary'
import type { GpsPhoto } from '@/types/photos'
import { formatDate, formatDateFromDate, formatTime } from '@/constants/workers'

interface DiaryPhotoCaptureProps {
  pendingPhotos: PendingDiaryPhoto[]
  existingPhotos?: GpsPhoto[]
  onChange: (photos: PendingDiaryPhoto[]) => void
}

export function DiaryPhotoCapture({ pendingPhotos, existingPhotos = [], onChange }: DiaryPhotoCaptureProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function processFile(file: File) {
    setError('')
    setLoading(true)
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
          ...address,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotografii se nepodařilo zpracovat.')
    } finally {
      setLoading(false)
    }
  }

  function removePending(index: number) {
    onChange(pendingPhotos.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-theme-secondary">Fotodokumentace</p>
        <p className="mb-3 text-xs text-theme-muted">
          Ke každé fotografii se automaticky uloží datum, čas, GPS a adresa.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl btn-neon px-3 py-2 text-sm">
            <Camera className="h-4 w-4" />
            Vyfotit
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl btn-neon px-3 py-2 text-sm">
            <ImagePlus className="h-4 w-4" />
            Galerie
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
          </label>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-theme-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Načítám GPS a adresu…
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {(existingPhotos.length > 0 || pendingPhotos.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {existingPhotos.map((photo) => (
            <PhotoPreview
              key={photo.id}
              src={getGpsPhotoUrl(photo.file_path)}
              date={formatDate(photo.captured_date)}
              time={formatTime(photo.captured_time)}
              address={photo.address_full}
            />
          ))}
          {pendingPhotos.map((photo, index) => (
            <div key={`pending-${index}`} className="neon-border rounded-xl p-2">
              <PhotoPreview
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
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoPreview({ src, date, time, address }: { src: string; date: string; time: string; address: string }) {
  return (
    <div>
      <img src={src} alt="" className="max-h-36 w-full rounded-lg object-cover" />
      <p className="mt-2 text-xs text-theme-primary">{date} · {time}</p>
      <p className="text-xs text-theme-muted">{address}</p>
    </div>
  )
}

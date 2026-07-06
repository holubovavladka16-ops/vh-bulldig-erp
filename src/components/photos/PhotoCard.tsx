import { MapPin, User } from 'lucide-react'
import { formatDate } from '@/constants/workers'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  formatGpsCoordinates,
  formatPhotoAddress,
} from '@/lib/photos/photoDisplay'
import { PhotoMiniMap } from '@/components/photos/PhotoMiniMap'
import type { GpsPhoto } from '@/types/photos'

interface PhotoCardProps {
  photo: GpsPhoto
  onClick: () => void
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const address = formatPhotoAddress(photo)
  const capturedBy = photo.creator_name?.trim() || photo.worker_name?.trim() || '—'

  return (
    <button
      type="button"
      onClick={onClick}
      className="neon-border flex h-full w-full flex-col overflow-hidden rounded-2xl text-left transition hover:shadow-[0_0_24px_var(--accent-glow)]"
    >
      <img
        src={getGpsPhotoUrl(photo.file_path)}
        alt={photo.file_name}
        className="h-40 w-full object-cover sm:h-44"
        loading="lazy"
      />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <PhotoMiniMap lat={photo.gps_lat} lng={photo.gps_lng} height={150} />

        <div className="space-y-2 text-sm">
          <p className="font-semibold text-theme-primary">
            {formatDate(photo.captured_date)} · {photo.captured_time.slice(0, 5)}
          </p>

          <p className="flex items-start gap-1.5 text-theme-secondary">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>{address}</span>
          </p>

          <p className="font-mono text-xs text-theme-muted">
            GPS: {formatGpsCoordinates(photo.gps_lat, photo.gps_lng)}
            {photo.gps_accuracy != null ? ` · ±${Math.round(photo.gps_accuracy)} m` : ''}
          </p>

          {photo.order_name && (
            <p className="text-theme-secondary">
              <span className="text-theme-muted">Zakázka:</span> {photo.order_name}
            </p>
          )}

          {photo.note && (
            <p className="text-theme-secondary">
              <span className="text-theme-muted">Poznámka:</span> {photo.note}
            </p>
          )}

          <p className="flex items-center gap-1.5 text-theme-muted">
            <User className="h-3.5 w-3.5" />
            <span>Pořídil: {capturedBy}</span>
          </p>
        </div>
      </div>
    </button>
  )
}

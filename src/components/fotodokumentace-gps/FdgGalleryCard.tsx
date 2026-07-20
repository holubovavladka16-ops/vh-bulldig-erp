import { FDG_GPS_UNVERIFIED_LABEL } from '@/constants/fotodokumentaceGps'
import { formatDate, formatTime } from '@/constants/workers'
import { getFdgPhotoUrl } from '@/lib/fotodokumentace-gps/service'
import { formatPhotoAddress, getOrderDisplayName, getPhotoAuthorName } from '@/lib/photos/photoDisplay'
import type { GpsPhoto } from '@/types/photos'

interface FdgGalleryCardProps {
  photo: GpsPhoto
  selected?: boolean
  selectMode?: boolean
  onClick: () => void
  onToggleSelect?: () => void
}

export function FdgGalleryCard({ photo, selected, selectMode, onClick, onToggleSelect }: FdgGalleryCardProps) {
  const gpsOk = photo.gps_lat != null && photo.gps_lng != null && photo.gps_verified !== false

  return (
    <button
      type="button"
      onClick={selectMode ? onToggleSelect : onClick}
      className={`w-full rounded-xl border text-left transition ${
        selected ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/40' : 'border-[var(--border-glass)]'
      } bg-[var(--bg-glass)] overflow-hidden`}
    >
      <img src={getFdgPhotoUrl(photo)} alt="" className="aspect-[4/3] w-full object-cover" />
      <div className="space-y-1 p-3 text-sm">
        <p className="font-medium text-theme-primary">{getOrderDisplayName(photo)}</p>
        <p className="text-theme-muted">
          {formatDate(photo.captured_date)} · {formatTime(photo.captured_time)}
        </p>
        <p className="line-clamp-2 text-xs text-theme-secondary">{formatPhotoAddress(photo)}</p>
        <p className="text-xs text-theme-muted">{getPhotoAuthorName(photo)}</p>
        <p className={`text-xs ${gpsOk ? 'text-green-400' : 'text-amber-400'}`}>
          {gpsOk ? 'GPS ověřeno' : FDG_GPS_UNVERIFIED_LABEL}
        </p>
      </div>
    </button>
  )
}

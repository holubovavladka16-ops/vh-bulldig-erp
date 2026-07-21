import { MapPin } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import { formatCaptureDateLabel, formatCaptureTime, formatPhotoAddress, getOrderDisplayName, getPhotoAuthorName } from '@/lib/photos/photoDisplay'
import type { GpsPhoto } from '@/types/photos'

interface GfaGalleryCardProps {
  photo: GpsPhoto
  selected?: boolean
  onClick: () => void
}

export function GfaGalleryCard({ photo, selected, onClick }: GfaGalleryCardProps) {
  const title = photo.title?.trim() || getOrderDisplayName(photo)

  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={`overflow-hidden transition ${selected ? 'ring-2 ring-lime-400/70' : 'hover:border-amber-400/40'}`}
      >
        <img
          src={getGpsPhotoUrl(photo.file_path)}
          alt={title}
          className="aspect-[4/3] w-full object-cover"
          loading="lazy"
        />
        <div className="space-y-1 p-3 text-sm">
          <p className="font-medium text-[var(--text-primary)]">{title}</p>
          <p className="text-[var(--text-muted)]">
            {formatCaptureDateLabel(photo.captured_date)} {formatCaptureTime(photo.captured_time)}
          </p>
          <p className="flex items-start gap-1 text-[var(--text-muted)]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{formatPhotoAddress(photo)}</span>
          </p>
          <p className="text-xs text-[var(--text-muted)]">{getPhotoAuthorName(photo)}</p>
        </div>
      </Card>
    </button>
  )
}

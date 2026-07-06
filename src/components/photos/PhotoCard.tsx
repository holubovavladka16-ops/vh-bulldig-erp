import { PhotoDocumentView } from '@/components/photos/PhotoDocumentView'
import type { GpsPhoto } from '@/types/photos'

interface PhotoCardProps {
  photo: GpsPhoto
  onClick: () => void
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition hover:scale-[1.01] hover:shadow-[0_0_28px_var(--accent-glow)]"
    >
      <PhotoDocumentView photo={photo} note={photo.note ?? ''} compact />
    </button>
  )
}

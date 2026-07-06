import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DiaryPhotoLocationPanel } from '@/components/diary/DiaryPhotoLocationPanel'
import type { GpsPhoto } from '@/types/photos'

interface DiaryPhotoCardProps {
  photo: GpsPhoto
  onRemove?: () => void
}

export function DiaryPhotoCard({ photo, onRemove }: DiaryPhotoCardProps) {
  return (
    <div className="neon-border rounded-xl p-3">
      <DiaryPhotoLocationPanel photo={photo} />
      {onRemove && (
        <Button type="button" variant="danger" size="sm" className="mt-3" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
          Odebrat z deníku
        </Button>
      )}
    </div>
  )
}

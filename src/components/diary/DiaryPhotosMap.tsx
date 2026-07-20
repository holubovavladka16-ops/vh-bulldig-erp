import { useState } from 'react'
import { PhotoMapView } from '@/components/photos/PhotoMapView'
import type { GpsPhoto } from '@/types/photos'

interface DiaryPhotosMapProps {
  photos: GpsPhoto[]
  className?: string
}

export function DiaryPhotosMap({ photos, className = '' }: DiaryPhotosMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(photos[0]?.id ?? null)

  if (photos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--border-glass)] px-4 py-8 text-center text-sm text-theme-muted">
        Pro zobrazení mapy přidejte fotografie k zápisu.
      </p>
    )
  }

  const selected = photos.find((p) => p.id === selectedId) ?? photos[0]

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-sm font-medium text-theme-secondary">Mapa vložených fotografií</p>
      <PhotoMapView
        photos={photos}
        selectedPhotoId={selected?.id}
        onPhotoSelect={setSelectedId}
        className="h-64 w-full rounded-xl"
        flyToSelected
      />
      {selected && (
        <p className="text-xs text-theme-muted">
          Vybraná poloha:{' '}
          {selected.address_full ||
            (selected.gps_lat != null && selected.gps_lng != null
              ? `${selected.gps_lat.toFixed(5)}, ${selected.gps_lng.toFixed(5)}`
              : '—')}
        </p>
      )}
    </div>
  )
}

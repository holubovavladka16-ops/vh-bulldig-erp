import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  X,
  Clock,
  User,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  downloadGpsPhoto,
  fetchGpsPhotoDetail,
  getGpsPhotoThumbnailUrl,
  getGpsPhotoUrl,
} from '@/lib/photos/api'
import { getGoogleMapsUrl } from '@/lib/photos/mapLinks'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
  getOrderDisplayName,
} from '@/lib/photos/photoDisplay'
import type { GpsPhoto, GpsPhotoDetail } from '@/types/photos'

interface PhotoLightboxProps {
  photos: GpsPhoto[]
  initialIndex: number
  onClose: () => void
  onIndexChange?: (index: number) => void
  onOpenOnMap?: (photo: GpsPhoto) => void
}

export function PhotoLightbox({
  photos,
  initialIndex,
  onClose,
  onIndexChange,
  onOpenOnMap,
}: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [detail, setDetail] = useState<GpsPhotoDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const touchRef = useRef<HTMLDivElement>(null)

  const photo = photos[index]

  const goTo = useCallback(
    (next: number) => {
      if (photos.length === 0) return
      const wrapped = (next + photos.length) % photos.length
      setIndex(wrapped)
      onIndexChange?.(wrapped)
    },
    [photos.length, onIndexChange]
  )

  useEffect(() => {
    setIndex(initialIndex)
  }, [initialIndex])

  useEffect(() => {
    if (!photo) return
    let cancelled = false
    setLoadingDetail(true)
    fetchGpsPhotoDetail(photo.id)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [photo?.id])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') goTo(index - 1)
      if (event.key === 'ArrowRight') goTo(index + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goTo, index, onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!photo) return null

  const displayPhoto = detail ?? photo
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)

  const lightbox = (
    <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Náhled fotografie">
      <div className="photo-lightbox__backdrop" onClick={onClose} aria-hidden="true" />

      <button type="button" className="photo-lightbox__close touch-target" onClick={onClose} aria-label="Zavřít">
        <X className="h-6 w-6" />
      </button>

      <button
        type="button"
        className="photo-lightbox__nav photo-lightbox__nav--prev touch-target"
        onClick={() => goTo(index - 1)}
        aria-label="Předchozí fotografie"
      >
        <ChevronLeft className="h-8 w-8" />
      </button>

      <button
        type="button"
        className="photo-lightbox__nav photo-lightbox__nav--next touch-target"
        onClick={() => goTo(index + 1)}
        aria-label="Další fotografie"
      >
        <ChevronRight className="h-8 w-8" />
      </button>

      <div
        ref={touchRef}
        className="photo-lightbox__stage"
        onTouchStart={(e) => setTouchStartX(e.changedTouches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touchStartX == null) return
          const delta = e.changedTouches[0]?.clientX - touchStartX
          if (delta != null && Math.abs(delta) > 48) {
            goTo(delta > 0 ? index - 1 : index + 1)
          }
          setTouchStartX(null)
        }}
      >
        <img
          src={getGpsPhotoUrl(photo.file_path)}
          alt={photo.file_name}
          className="photo-lightbox__image"
          draggable={false}
        />
        <span className="photo-lightbox__counter">
          {index + 1} / {photos.length}
        </span>
      </div>

      <aside className="photo-lightbox__meta glass-panel">
        <p className="photo-lightbox__order">{getOrderDisplayName(displayPhoto)}</p>
        <p className="photo-lightbox__meta-row">
          <Clock className="h-4 w-4 shrink-0" />
          {formatCaptureDateLabel(displayPhoto.captured_date)} · {formatCaptureTime(displayPhoto.captured_time)}
        </p>
        {displayPhoto.creator_name && (
          <p className="photo-lightbox__meta-row">
            <User className="h-4 w-4 shrink-0" />
            {displayPhoto.creator_name}
          </p>
        )}
        <p className="photo-lightbox__meta-row">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-400" />
          {formatGpsCoordinatesCompact(displayPhoto.gps_lat, displayPhoto.gps_lng)}
        </p>
        {formatPhotoAddress(displayPhoto) && (
          <p className="photo-lightbox__address">{formatPhotoAddress(displayPhoto)}</p>
        )}
        {(displayPhoto.note ?? detail?.note) && (
          <p className="photo-lightbox__note">{displayPhoto.note ?? detail?.note}</p>
        )}

        <div className="photo-lightbox__actions">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px] flex-1"
            onClick={() => void downloadGpsPhoto(photo.file_path, photo.file_name)}
          >
            <Download className="h-4 w-4" />
            Stáhnout
          </Button>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neon-secondary inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
          >
            <ExternalLink className="h-4 w-4" />
            Otevřít v mapě
          </a>
          {onOpenOnMap && (
            <Button
              type="button"
              className="min-h-[44px] flex-1"
              onClick={() => onOpenOnMap(photo)}
            >
              <MapPin className="h-4 w-4" />
              Zobrazit na mapě
            </Button>
          )}
        </div>
        {loadingDetail && <p className="text-xs text-theme-muted">Načítám detail…</p>}
      </aside>
    </div>
  )

  return createPortal(lightbox, document.body)
}

/** Kompaktní náhled pro mřížku galerie. */
export function PhotoGalleryThumb({ photo, onClick }: { photo: GpsPhoto; onClick: () => void }) {
  const thumbUrl = getGpsPhotoThumbnailUrl(photo.file_path)
  const fullUrl = getGpsPhotoUrl(photo.file_path)

  return (
    <button type="button" onClick={onClick} className="photo-gallery-thumb group">
      <div className="photo-gallery-thumb__frame">
        <img
          src={thumbUrl}
          alt={photo.file_name}
          loading="lazy"
          decoding="async"
          className="photo-gallery-thumb__img"
          onError={(event) => {
            const img = event.currentTarget
            if (img.src !== fullUrl) img.src = fullUrl
          }}
        />
        <div className="photo-gallery-thumb__overlay">
          <span className="photo-gallery-thumb__order">{getOrderDisplayName(photo)}</span>
          <span className="photo-gallery-thumb__date">{formatCaptureDateLabel(photo.captured_date)}</span>
        </div>
      </div>
    </button>
  )
}

export function PhotoGallerySkeleton() {
  return (
    <div className="photo-gallery-thumb photo-gallery-thumb--skeleton" aria-hidden="true">
      <div className="photo-gallery-thumb__frame animate-pulse bg-white/5" />
    </div>
  )
}

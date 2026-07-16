import { useCallback, useEffect, useRef, useState } from 'react'
import type { GpsPhoto, GpsPhotoFilters } from '@/types/photos'
import { fetchGpsPhotosPage, GPS_PHOTOS_PAGE_SIZE } from '@/lib/photos/api'
import { PhotoGallerySkeleton, PhotoGalleryThumb } from '@/components/photos/PhotoLightbox'

interface PhotoGalleryGridProps {
  filters: GpsPhotoFilters
  onPhotoClick: (photo: GpsPhoto, allPhotos: GpsPhoto[], index: number) => void
  reloadToken?: number
}

export function PhotoGalleryGrid({ filters, onPhotoClick, reloadToken = 0 }: PhotoGalleryGridProps) {
  const [photos, setPhotos] = useState<GpsPhoto[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadPage = useCallback(
    async (pageIndex: number, append: boolean) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (append) setLoadingMore(true)
      else setLoading(true)

      try {
        const result = await fetchGpsPhotosPage(filters, pageIndex, GPS_PHOTOS_PAGE_SIZE)
        if (controller.signal.aborted) return
        setPhotos((prev) => (append ? [...prev, ...result.photos] : result.photos))
        setTotal(result.total)
        setHasMore(result.hasMore)
        setPage(pageIndex)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [filters]
  )

  useEffect(() => {
    void loadPage(0, false)
    return () => abortRef.current?.abort()
  }, [loadPage, reloadToken])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadPage(page + 1, true)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, loadPage, page])

  if (loading) {
    return (
      <div className="photo-gallery-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <PhotoGallerySkeleton key={i} />
        ))}
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <p className="py-16 text-center text-theme-muted">
        Zatím žádné fotografie. Přepněte na záložku Focení.
      </p>
    )
  }

  return (
    <>
      <p className="mb-3 text-sm text-theme-secondary">
        {photos.length} z {total} fotografií
      </p>
      <div className="photo-gallery-grid">
        {photos.map((photo, index) => (
          <PhotoGalleryThumb
            key={photo.id}
            photo={photo}
            onClick={() => onPhotoClick(photo, photos, index)}
          />
        ))}
        {loadingMore &&
          Array.from({ length: 4 }).map((_, i) => <PhotoGallerySkeleton key={`more-${i}`} />)}
      </div>
      <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
    </>
  )
}

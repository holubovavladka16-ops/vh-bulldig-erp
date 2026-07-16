import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, LayoutGrid, Map, SlidersHorizontal } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { PhotoCaptureFlow } from '@/components/photos/PhotoCaptureFlow'
import { PhotoGalleryGrid } from '@/components/photos/PhotoGalleryGrid'
import { PhotoLightbox } from '@/components/photos/PhotoLightbox'
import { PhotoMapView } from '@/components/photos/PhotoMapView'
import { useAuth } from '@/context/AuthContext'
import { fetchGpsPhotosForMap } from '@/lib/photos/api'
import { fetchJobOrders } from '@/lib/orders/api'
import { fetchWorkers } from '@/lib/workers/api'
import type { GpsPhoto, GpsPhotoFilters } from '@/types/photos'

type PageView = 'camera' | 'gallery'
type GalleryView = 'list' | 'map'

function sameGpsLocation(a: GpsPhoto, b: GpsPhoto): boolean {
  return (
    Math.abs(a.gps_lat - b.gps_lat) < 0.00005 &&
    Math.abs(a.gps_lng - b.gps_lng) < 0.00005
  )
}

function photosAtSameLocation(photos: GpsPhoto[], photo: GpsPhoto): GpsPhoto[] {
  const group = photos.filter((item) => sameGpsLocation(item, photo))
  return group.length > 0 ? group : [photo]
}

export function PhotosModulePage() {
  const { user, profile } = useAuth()
  const creatorName = profile?.full_name?.trim() || user?.email || '—'

  const [filters, setFilters] = useState<GpsPhotoFilters>({})
  const [pageView, setPageView] = useState<PageView>('camera')
  const [galleryView, setGalleryView] = useState<GalleryView>('list')
  const [mapPhotos, setMapPhotos] = useState<GpsPhoto[]>([])
  const [mapLoading, setMapLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [lightboxPhotos, setLightboxPhotos] = useState<GpsPhoto[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [mapFocusPhotoId, setMapFocusPhotoId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [workerOptions, setWorkerOptions] = useState<{ value: string; label: string }[]>([])

  const stableFilters = useMemo(
    () => ({
      orderId: filters.orderId,
      workerId: filters.workerId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    [filters.orderId, filters.workerId, filters.dateFrom, filters.dateTo]
  )

  useEffect(() => {
    Promise.all([
      fetchJobOrders().then((orders) => orders.map((o) => ({ value: o.id, label: o.name }))),
      fetchWorkers('aktivni').then((workers) =>
        workers.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` }))
      ),
    ]).then(([orders, workers]) => {
      setOrderOptions([{ value: '', label: 'Všechny zakázky' }, ...orders])
      setWorkerOptions([{ value: '', label: 'Všichni uživatelé' }, ...workers])
    })
  }, [])

  const loadMapPhotos = useCallback(async () => {
    setMapLoading(true)
    try {
      setMapPhotos(await fetchGpsPhotosForMap(stableFilters))
    } finally {
      setMapLoading(false)
    }
  }, [stableFilters])

  useEffect(() => {
    if (pageView !== 'gallery' || galleryView !== 'map') return
    const timeout = setTimeout(() => void loadMapPhotos(), 250)
    return () => clearTimeout(timeout)
  }, [pageView, galleryView, loadMapPhotos, reloadToken])

  function handlePhotoCreated() {
    setReloadToken((value) => value + 1)
    setPageView('gallery')
  }

  function openLightbox(_photo: GpsPhoto, allPhotos: GpsPhoto[], index: number) {
    setLightboxPhotos(allPhotos)
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  function openLightboxFromMap(photoId: string) {
    const photo = mapPhotos.find((item) => item.id === photoId)
    if (!photo) return
    const group = photosAtSameLocation(mapPhotos, photo)
    const index = group.findIndex((item) => item.id === photoId)
    setLightboxPhotos(group)
    setLightboxIndex(index >= 0 ? index : 0)
    setLightboxOpen(true)
  }

  function handleOpenOnMap(photo: GpsPhoto) {
    setLightboxOpen(false)
    setGalleryView('map')
    setMapFocusPhotoId(photo.id)
    void loadMapPhotos()
  }

  const filterFields = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Select
        label="Zakázka"
        options={orderOptions}
        value={filters.orderId ?? ''}
        onChange={(e) => setFilters((prev) => ({ ...prev, orderId: e.target.value || undefined }))}
      />
      <Select
        label="Uživatel"
        options={workerOptions}
        value={filters.workerId ?? ''}
        onChange={(e) => setFilters((prev) => ({ ...prev, workerId: e.target.value || undefined }))}
      />
      <Input
        label="Datum od"
        type="date"
        value={filters.dateFrom ?? ''}
        onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))}
      />
      <Input
        label="Datum do"
        type="date"
        value={filters.dateTo ?? ''}
        onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value || undefined }))}
      />
    </div>
  )

  return (
    <AppLayout>
      <PageHeader
        title="Fotodokumentace s GPS"
        description="Nejdříve kamera a zaměření polohy, poté vyfocení a uložení. GPS, adresa a mapa jsou vidět už při focení."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={pageView === 'camera' ? 'primary' : 'secondary'}
          onClick={() => setPageView('camera')}
          disabled={!user}
        >
          <Camera className="h-4 w-4" />
          Focení
        </Button>
        <Button
          type="button"
          size="sm"
          variant={pageView === 'gallery' ? 'primary' : 'secondary'}
          onClick={() => setPageView('gallery')}
        >
          <LayoutGrid className="h-4 w-4" />
          Galerie
        </Button>
      </div>

      {pageView === 'camera' && user ? (
        <Card className="p-4 sm:p-6">
          <PhotoCaptureFlow
            active
            uploadedBy={user.id}
            creatorName={creatorName}
            onCreated={handlePhotoCreated}
            onCancel={() => setPageView('gallery')}
          />
        </Card>
      ) : (
        <>
          <Card className="mb-4 hidden sm:block">{filterFields}</Card>

          <div className="mb-4 sm:hidden">
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px] w-full"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtry
            </Button>
          </div>

          {filtersOpen && (
            <div className="photo-map-filter-sheet sm:hidden">
              <button
                type="button"
                className="photo-map-filter-sheet__backdrop"
                onClick={() => setFiltersOpen(false)}
                aria-label="Zavřít filtry"
              />
              <div className="photo-map-filter-sheet__panel glass-panel">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-theme-primary">Filtry</h3>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setFiltersOpen(false)}>
                    Hotovo
                  </Button>
                </div>
                {filterFields}
              </div>
            </div>
          )}

          <Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-theme-secondary">
                {galleryView === 'map' && mapLoading ? 'Načítám mapu…' : 'Fotodokumentace GPS'}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={galleryView === 'list' ? 'primary' : 'secondary'}
                  onClick={() => setGalleryView('list')}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Galerie
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={galleryView === 'map' ? 'primary' : 'secondary'}
                  onClick={() => setGalleryView('map')}
                >
                  <Map className="h-4 w-4" />
                  Mapa
                </Button>
              </div>
            </div>
          </Card>

          {galleryView === 'map' ? (
            <div className="relative min-h-0 flex-1">
              {mapLoading ? (
                <div className="flex justify-center py-16">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
                </div>
              ) : mapPhotos.length === 0 ? (
                <Card className="py-16 text-center text-theme-muted">
                  Zatím žádné fotografie na mapě. Přepněte na záložku Focení.
                </Card>
              ) : (
                <PhotoMapView
                  photos={mapPhotos}
                  selectedPhotoId={mapFocusPhotoId}
                  onPhotoSelect={openLightboxFromMap}
                  fullHeight
                  flyToSelected={Boolean(mapFocusPhotoId)}
                />
              )}
              <p className="mt-2 text-center text-xs text-theme-muted sm:text-left">
                Klepněte na bod nebo cluster pro náhled. Otevřete detail ve fullscreen prohlížeči.
              </p>
            </div>
          ) : (
            <PhotoGalleryGrid
              filters={stableFilters}
              reloadToken={reloadToken}
              onPhotoClick={openLightbox}
            />
          )}
        </>
      )}

      {lightboxOpen && lightboxPhotos.length > 0 && (
        <PhotoLightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setLightboxIndex}
          onOpenOnMap={handleOpenOnMap}
        />
      )}

      {user && pageView === 'gallery' && (
        <button
          type="button"
          onClick={() => setPageView('camera')}
          className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full btn-neon-primary shadow-lg sm:hidden"
          aria-label="Vyfotit novou fotografii"
        >
          <Camera className="h-6 w-6" />
        </button>
      )}
    </AppLayout>
  )
}

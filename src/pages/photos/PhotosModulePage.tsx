import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Camera, LayoutGrid, Map } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { PhotoCaptureFlow } from '@/components/photos/PhotoCaptureFlow'
import { PhotoDetailModal } from '@/components/photos/PhotoDetailModal'
import { PhotoMapDetailPanel } from '@/components/photos/PhotoMapDetailPanel'
import { PhotoMapView } from '@/components/photos/PhotoMapView'
import { PhotoCard } from '@/components/photos/PhotoCard'
import { useAuth } from '@/context/AuthContext'
import { fetchGpsPhotos } from '@/lib/photos/api'
import { fetchJobOrders } from '@/lib/orders/api'
import { fetchWorkers } from '@/lib/workers/api'
import type { GpsPhoto, GpsPhotoFilters } from '@/types/photos'

type PageView = 'camera' | 'gallery'
type GalleryView = 'list' | 'map'

export function PhotosModulePage() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const creatorName = profile?.full_name?.trim() || user?.email || '—'

  const [photos, setPhotos] = useState<GpsPhoto[]>([])
  const [filters, setFilters] = useState<GpsPhotoFilters>({})
  const [pageView, setPageView] = useState<PageView>('camera')
  const [galleryView, setGalleryView] = useState<GalleryView>('list')
  const [loading, setLoading] = useState(true)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [workerOptions, setWorkerOptions] = useState<{ value: string; label: string }[]>([])

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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPhotos(await fetchGpsPhotos(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  useEffect(() => {
    const photoId = searchParams.get('foto')?.trim()
    if (!photoId) return
    setSelectedPhotoId(photoId)
    setPageView('gallery')
  }, [searchParams])

  function handlePhotoCreated() {
    void load()
    setPageView('gallery')
  }

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
          <Card className="mb-4">
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-glass)] pt-4">
              <p className="text-sm text-theme-secondary">
                {loading ? 'Načítám…' : `${photos.length} ${photos.length === 1 ? 'fotografie' : 'fotografií'}`}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={galleryView === 'list' ? 'primary' : 'secondary'}
                  onClick={() => setGalleryView('list')}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Karty
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={galleryView === 'map' ? 'primary' : 'secondary'}
                  onClick={() => setGalleryView('map')}
                >
                  <Map className="h-4 w-4" />
                  Mapa s tečkami
                </Button>
              </div>
            </div>
          </Card>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
            </div>
          ) : photos.length === 0 ? (
            <Card className="py-16 text-center text-theme-muted">
              Zatím žádné fotografie. Přepněte na záložku Focení — GPS, adresa a mapa se zobrazí před vyfocením.
            </Card>
          ) : galleryView === 'map' ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
              <div className={`relative min-h-0 flex-1 ${selectedPhotoId ? 'lg:min-w-0' : ''}`}>
                <PhotoMapView
                  photos={photos}
                  selectedPhotoId={selectedPhotoId}
                  onPhotoSelect={setSelectedPhotoId}
                  fullHeight
                  flyToSelected
                />
                <p className="mt-2 text-center text-xs text-theme-muted sm:text-left">
                  Klepněte na tečku pro detail fotky, zakázku, GPS a sdílení.
                </p>
              </div>

              {selectedPhotoId && (
                <>
                  <PhotoMapDetailPanel
                    photoId={selectedPhotoId}
                    onClose={() => setSelectedPhotoId(null)}
                    onUpdated={load}
                    variant="sidebar"
                  />
                  <PhotoMapDetailPanel
                    photoId={selectedPhotoId}
                    onClose={() => setSelectedPhotoId(null)}
                    onUpdated={load}
                    variant="sheet"
                  />
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onClick={() => setSelectedPhotoId(photo.id)} />
              ))}
            </div>
          )}

          {selectedPhotoId && galleryView === 'list' && (
            <PhotoDetailModal
              photoId={selectedPhotoId}
              onClose={() => setSelectedPhotoId(null)}
              onUpdated={load}
            />
          )}
        </>
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

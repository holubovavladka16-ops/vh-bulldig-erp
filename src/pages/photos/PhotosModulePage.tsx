import { useCallback, useEffect, useState } from 'react'
import { Camera, LayoutGrid, Map } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { PhotoCaptureModal } from '@/components/photos/PhotoCaptureModal'
import { PhotoDetailModal } from '@/components/photos/PhotoDetailModal'
import { PhotoMapView } from '@/components/photos/PhotoMapView'
import { PhotoCard } from '@/components/photos/PhotoCard'
import { useAuth } from '@/context/AuthContext'
import { fetchGpsPhotos } from '@/lib/photos/api'
import { fetchJobOrders } from '@/lib/orders/api'
import { fetchWorkers } from '@/lib/workers/api'
import type { GpsPhoto, GpsPhotoFilters } from '@/types/photos'

type ViewMode = 'map' | 'list'

export function PhotosModulePage() {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<GpsPhoto[]>([])
  const [filters, setFilters] = useState<GpsPhotoFilters>({})
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [loading, setLoading] = useState(true)
  const [captureOpen, setCaptureOpen] = useState(false)
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

  return (
    <AppLayout>
      <PageHeader
        title="Fotodokumentace s GPS"
        description="Každá fotografie má vlastní kartu s mapou, adresou, souřadnicemi a metadaty. Mobilní focení je prioritou."
        action={
          user ? (
            <Button onClick={() => setCaptureOpen(true)} className="hidden sm:inline-flex">
              <Camera className="h-4 w-4" />
              Nová fotografie
            </Button>
          ) : undefined
        }
      />

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
              variant={viewMode === 'list' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
            >
              <LayoutGrid className="h-4 w-4" />
              Karty
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'map' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('map')}
              aria-pressed={viewMode === 'map'}
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
          Zatím žádné fotografie. Vyfotte první snímek — GPS, adresa a tečka na mapě se uloží automaticky.
        </Card>
      ) : viewMode === 'map' ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <PhotoMapView
              photos={photos}
              selectedPhotoId={selectedPhotoId}
              onPhotoSelect={setSelectedPhotoId}
            />
            <p className="text-center text-xs text-theme-muted sm:text-left">
              Klepněte na tečku pro detail. Každá tečka odpovídá místu pořízení fotografie.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-theme-primary">Všechny fotografie</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onClick={() => setSelectedPhotoId(photo.id)} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} onClick={() => setSelectedPhotoId(photo.id)} />
          ))}
        </div>
      )}

      {user && (
        <>
          <button
            type="button"
            onClick={() => setCaptureOpen(true)}
            className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full btn-neon-primary shadow-lg sm:hidden"
            aria-label="Vyfotit novou fotografii"
          >
            <Camera className="h-6 w-6" />
          </button>

          <PhotoCaptureModal
            open={captureOpen}
            uploadedBy={user.id}
            onClose={() => setCaptureOpen(false)}
            onCreated={load}
          />
        </>
      )}

      <PhotoDetailModal
        photoId={selectedPhotoId}
        onClose={() => setSelectedPhotoId(null)}
        onUpdated={load}
      />
    </AppLayout>
  )
}

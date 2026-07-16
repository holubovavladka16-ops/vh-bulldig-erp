import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapPin, SlidersHorizontal } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { ConstructionPointMapView } from '@/components/constructionPoints/ConstructionPointMapView'
import { ConstructionPointDetailPanel } from '@/components/constructionPoints/ConstructionPointDetailPanel'
import { PhotoLightbox } from '@/components/photos/PhotoLightbox'
import { fetchConstructionPoints } from '@/lib/constructionPoints/api'
import { fetchJobOrders } from '@/lib/orders/api'
import { fetchWorkers } from '@/lib/workers/api'
import type { ConstructionPointFilters } from '@/types/constructionPoints'
import type { GpsPhoto } from '@/types/photos'

export function PhotosMapModulePage() {
  const [points, setPoints] = useState<Awaited<ReturnType<typeof fetchConstructionPoints>>>([])
  const [filters, setFilters] = useState<ConstructionPointFilters>({})
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [lightboxPhotos, setLightboxPhotos] = useState<GpsPhoto[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPoints(await fetchConstructionPoints(stableFilters))
    } finally {
      setLoading(false)
    }
  }, [stableFilters])

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250)
    return () => clearTimeout(timeout)
  }, [load])

  function openPhotoLightbox(photos: GpsPhoto[], index: number) {
    setLightboxPhotos(photos)
    setLightboxIndex(index)
    setLightboxOpen(true)
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
        label="Uživatel / dělník"
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
        title="Fotky na mapě"
        description="Každá tečka je stavební bod s kompletní historií fotografií a poznámek. První GPS fotografie automaticky vytvoří nový bod."
      />

      <Card className="mb-4 hidden sm:block">{filterFields}</Card>

      <div className="mb-4 sm:hidden">
        <Button
          type="button"
          variant="secondary"
          className="min-h-[44px] w-full"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtry mapy
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
              <h3 className="font-semibold text-theme-primary">Filtry mapy</h3>
              <Button type="button" size="sm" variant="secondary" onClick={() => setFiltersOpen(false)}>
                Hotovo
              </Button>
            </div>
            {filterFields}
          </div>
        </div>
      )}

      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-theme-secondary">
        <MapPin className="h-4 w-4 text-accent" />
        {loading
          ? 'Načítám mapu…'
          : `${points.length} ${points.length === 1 ? 'stavební bod' : points.length < 5 ? 'stavební body' : 'stavebních bodů'} · clustering · mapa / satelit`}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className={`relative min-h-0 flex-1 ${selectedPointId ? 'lg:min-w-0' : ''}`}>
          {points.length === 0 && !loading ? (
            <Card className="flex min-h-[320px] flex-col items-center justify-center py-16 text-center text-theme-muted">
              <MapPin className="mb-3 h-10 w-10 opacity-40" />
              <p>Zatím žádné stavební body na mapě.</p>
              <p className="mt-2 max-w-sm text-sm">
                Vyfoťte první snímek v modulu Fotodokumentace GPS — automaticky se vytvoří stavební bod.
              </p>
            </Card>
          ) : (
            <ConstructionPointMapView
              points={points}
              selectedPointId={selectedPointId}
              onPointSelect={setSelectedPointId}
              fullHeight
              flyToSelected
              className={loading ? 'opacity-60' : ''}
            />
          )}
        </div>

        {selectedPointId && (
          <ConstructionPointDetailPanel
            pointId={selectedPointId}
            onClose={() => setSelectedPointId(null)}
            onUpdated={load}
            onOpenPhotoLightbox={openPhotoLightbox}
          />
        )}
      </div>

      {lightboxOpen && lightboxPhotos.length > 0 && (
        <PhotoLightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </AppLayout>
  )
}

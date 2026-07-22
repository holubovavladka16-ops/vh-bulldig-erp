import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ProjectMapView } from '@/components/zakazkyMapa/ProjectMapView'
import { ProjectList } from '@/components/zakazkyMapa/ProjectList'
import { ProjectMarkerPopup } from '@/components/zakazkyMapa/ProjectMarkerPopup'
import { fetchProjectMapMarkersWithOrders, filterProjectMapMarkers } from '@/lib/zakazkyMapa/api'
import { PROJECT_MARKER_COLOR_FILTER_OPTIONS } from '@/constants/zakazkyMapa'
import type { ProjectMapMarkerFilters, ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'

export function ZakazkyMapaPage() {
  const [items, setItems] = useState<ProjectMapMarkerWithOrder[]>([])
  const [filters, setFilters] = useState<ProjectMapMarkerFilters>({})
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await fetchProjectMapMarkersWithOrders())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení mapy se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredItems = useMemo(
    () => filterProjectMapMarkers(items, filters),
    [items, filters]
  )

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.project_id === selectedProjectId) ?? null,
    [filteredItems, selectedProjectId]
  )

  useEffect(() => {
    if (selectedProjectId && !selectedItem) {
      setSelectedProjectId(null)
    }
  }, [selectedProjectId, selectedItem])

  return (
    <AppLayout>
      <PageHeader
        title="Zakázky a mapa"
        description="Přehled hlavních špendlíků zakázek na mapě"
      />

      {error ? (
        <Card className="mb-4 border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</Card>
      ) : null}

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_280px]">
        <Input
          label="Vyhledávání"
          placeholder="Název zakázky, město, objednatel…"
          value={filters.search ?? ''}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, search: event.target.value }))
          }
        />
        <Select
          label="Barva špendlíku"
          options={PROJECT_MARKER_COLOR_FILTER_OPTIONS}
          value={filters.markerColor ?? ''}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              markerColor: event.target.value as ProjectMapMarkerFilters['markerColor'],
            }))
          }
        />
      </div>

      <p className="mb-4 text-sm text-theme-muted">
        Zobrazeno zakázek: <strong className="text-theme-primary">{filteredItems.length}</strong>
      </p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="min-w-0 space-y-4">
          <ProjectMapView
            items={filteredItems}
            selectedProjectId={selectedProjectId}
            onSelect={setSelectedProjectId}
          />

          {selectedItem ? (
            <div className="xl:hidden">
              <ProjectMarkerPopup item={selectedItem} onClose={() => setSelectedProjectId(null)} />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {selectedItem ? (
            <div className="hidden xl:block">
              <ProjectMarkerPopup item={selectedItem} onClose={() => setSelectedProjectId(null)} />
            </div>
          ) : null}

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-theme-muted">
              Přehled zakázek
            </h2>
            <ProjectList
              items={filteredItems}
              selectedProjectId={selectedProjectId}
              onSelect={setSelectedProjectId}
              loading={loading}
            />
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

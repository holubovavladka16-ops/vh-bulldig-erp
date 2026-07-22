import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DiaryFormModal } from '@/components/diary/DiaryFormModal'
import { ProjectMapView } from '@/components/zakazkyMapa/ProjectMapView'
import { ProjectList } from '@/components/zakazkyMapa/ProjectList'
import { ProjectMarkerPopup } from '@/components/zakazkyMapa/ProjectMarkerPopup'
import { useAuth } from '@/context/AuthContext'
import { canEditMarkerColor, isAdministrator } from '@/constants/permissions'
import { createDiaryEntry } from '@/lib/diary/api'
import { fetchJobOrders } from '@/lib/orders/api'
import { fetchProjectMapMarkersWithOrders, filterProjectMapMarkers, fetchProjectMapMarkerByProjectId } from '@/lib/zakazkyMapa/api'
import { PROJECT_MARKER_COLOR_FILTER_OPTIONS } from '@/constants/zakazkyMapa'
import type { ConstructionDiaryCreateInput } from '@/types/diary'
import type { ProjectMapMarkerFilters, ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'

export function ZakazkyMapaPage() {
  const { profile, user } = useAuth()
  const isAdmin = profile ? isAdministrator(profile.role) : false
  const canOverrideColor = profile ? canEditMarkerColor(profile.role) : false

  const [items, setItems] = useState<ProjectMapMarkerWithOrder[]>([])
  const [filters, setFilters] = useState<ProjectMapMarkerFilters>({})
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [diaryFormOpen, setDiaryFormOpen] = useState(false)
  const [diaryPrefillOrderId, setDiaryPrefillOrderId] = useState<string | null>(null)
  const [diaryRefreshToken, setDiaryRefreshToken] = useState(0)
  const [colorHistoryRefreshToken, setColorHistoryRefreshToken] = useState(0)

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
    fetchJobOrders()
      .then((orders) => setOrderOptions(orders.map((order) => ({ value: order.id, label: order.name }))))
      .catch(() => {})
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

  const refreshMarker = useCallback(async (projectId: string) => {
    try {
      const updated = await fetchProjectMapMarkerByProjectId(projectId)
      if (!updated) return
      setItems((prev) =>
        prev.map((item) => (item.project_id === projectId ? updated : item))
      )
    } catch {
      // Barva se obnoví při příštím načtení stránky.
    }
  }, [])

  function handleOpenDiaryForm(orderId: string) {
    setDiaryPrefillOrderId(orderId)
    setDiaryFormOpen(true)
  }

  const handleMarkerColorChanged = useCallback(
    async (projectId: string) => {
      await refreshMarker(projectId)
      setColorHistoryRefreshToken((token) => token + 1)
    },
    [refreshMarker]
  )

  async function handleCreateDiaryEntry(data: ConstructionDiaryCreateInput) {
    if (!user) return
    await createDiaryEntry(data, user.id)
    setDiaryFormOpen(false)
    setDiaryPrefillOrderId(null)
    setDiaryRefreshToken((token) => token + 1)
    if (data.order_id) {
      await refreshMarker(data.order_id)
    }
  }

  const popupProps = selectedItem
    ? {
        item: selectedItem,
        onClose: () => setSelectedProjectId(null),
        canCreateDiaryEntry: isAdmin,
        onCreateDiaryEntry: handleOpenDiaryForm,
        diaryRefreshToken,
        canEditMarkerColor: canOverrideColor,
        userId: user?.id,
        onMarkerColorChanged: handleMarkerColorChanged,
        colorHistoryRefreshToken,
      }
    : null

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

          {popupProps ? (
            <div className="xl:hidden">
              <ProjectMarkerPopup {...popupProps} />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {popupProps ? (
            <div className="hidden xl:block">
              <ProjectMarkerPopup {...popupProps} />
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

      <DiaryFormModal
        open={diaryFormOpen}
        orderOptions={orderOptions}
        defaultOrderId={diaryPrefillOrderId ?? undefined}
        onClose={() => {
          setDiaryFormOpen(false)
          setDiaryPrefillOrderId(null)
        }}
        onSubmit={handleCreateDiaryEntry}
      />
    </AppLayout>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DiaryFormModal } from '@/components/diary/DiaryFormModal'
import { ProjectMapView } from '@/components/zakazkyMapa/ProjectMapView'
import { ProjectList } from '@/components/zakazkyMapa/ProjectList'
import { ProjectMarkerPopup } from '@/components/zakazkyMapa/ProjectMarkerPopup'
import { ProjectNotificationsPanel } from '@/components/zakazkyMapa/ProjectNotificationsPanel'
import { useAuth } from '@/context/AuthContext'
import { canEditMarkerColor, canApproveDiaryEntry, isAdministrator, isMajitel } from '@/constants/permissions'
import { createDiaryEntry } from '@/lib/diary/api'
import { fetchJobOrders } from '@/lib/orders/api'
import { fetchProjectsWithMarkersFromOrders, filterProjectMapMarkers, fetchProjectMapMarkerByProjectId } from '@/lib/zakazkyMapa/api'
import { backfillMissingProjectLocations, replenishProjectMapLocation } from '@/lib/zakazkyMapa/createProjectMapMarker'
import { MAP_ORDERS_CHANGED_EVENT } from '@/lib/zakazkyMapa/mapEvents'
import { isValidProjectMarkerGps } from '@/lib/zakazkyMapa/markerGps'
import { PROJECT_MARKER_COLOR_FILTER_OPTIONS } from '@/constants/zakazkyMapa'
import type { ConstructionDiaryCreateInput } from '@/types/diary'
import type { ProjectMapMarkerFilters, ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'

export function ZakazkyMapaPage() {
  const { profile, user } = useAuth()
  const [searchParams] = useSearchParams()
  const isAdmin = profile ? isAdministrator(profile.role) : false
  const isOwner = profile ? isMajitel(profile.role) : false
  const canOverrideColor = profile ? canEditMarkerColor(profile.role) : false
  const canApproveDiary = profile ? canApproveDiaryEntry(profile.role) : false
  const canManageNotifications = isAdmin || isOwner

  const [items, setItems] = useState<ProjectMapMarkerWithOrder[]>([])
  const [filters, setFilters] = useState<ProjectMapMarkerFilters>({})
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [backfilling, setBackfilling] = useState(false)
  const [replenishingId, setReplenishingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [diaryFormOpen, setDiaryFormOpen] = useState(false)
  const [diaryPrefillOrderId, setDiaryPrefillOrderId] = useState<string | null>(null)
  const [diaryRefreshToken, setDiaryRefreshToken] = useState(0)
  const [colorHistoryRefreshToken, setColorHistoryRefreshToken] = useState(0)
  const backfillInFlightRef = useRef(false)
  const backfilledIdsRef = useRef(new Set<string>())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await fetchProjectsWithMarkersFromOrders())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení mapy se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshProjectOnMap = useCallback(async (projectId: string) => {
    const updated = await fetchProjectMapMarkerByProjectId(projectId)
    if (!updated) return
    setItems((prev) =>
      prev.map((item) => (item.project_id === projectId ? updated : item))
    )
  }, [])

  const runBackfill = useCallback(
    async (sourceItems: ProjectMapMarkerWithOrder[]) => {
      if (backfillInFlightRef.current) return
      const ordersNeedingGps = sourceItems
        .filter(
          (item) =>
            !backfilledIdsRef.current.has(item.project_id) &&
            !isValidProjectMarkerGps(item.gps_lat, item.gps_lng) &&
            Boolean(item.order.location?.trim())
        )
        .map((item) => item.order)

      if (ordersNeedingGps.length === 0) return

      backfillInFlightRef.current = true
      setBackfilling(true)
      try {
        for (const order of ordersNeedingGps) {
          backfilledIdsRef.current.add(order.id)
        }
        await backfillMissingProjectLocations(ordersNeedingGps, async (result) => {
          if (result.hasGps) {
            await refreshProjectOnMap(result.projectId)
          }
        })
      } finally {
        backfillInFlightRef.current = false
        setBackfilling(false)
      }
    },
    [refreshProjectOnMap]
  )

  useEffect(() => {
    void load()
    fetchJobOrders()
      .then((orders) => setOrderOptions(orders.map((order) => ({ value: order.id, label: order.name }))))
      .catch(() => {})
  }, [load])

  useEffect(() => {
    if (loading || items.length === 0) return
    void runBackfill(items)
  }, [loading, items.length, runBackfill])

  useEffect(() => {
    function handleRefresh() {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }

    function handleOrdersChanged() {
      void (async () => {
        await load()
        const fresh = await fetchProjectsWithMarkersFromOrders()
        await runBackfill(fresh)
      })()
    }

    window.addEventListener('focus', handleRefresh)
    document.addEventListener('visibilitychange', handleRefresh)
    window.addEventListener(MAP_ORDERS_CHANGED_EVENT, handleOrdersChanged)
    return () => {
      window.removeEventListener('focus', handleRefresh)
      document.removeEventListener('visibilitychange', handleRefresh)
      window.removeEventListener(MAP_ORDERS_CHANGED_EVENT, handleOrdersChanged)
    }
  }, [load, runBackfill])

  useEffect(() => {
    const projectId = searchParams.get('projectId')?.trim()
    if (projectId) {
      setSelectedProjectId(projectId)
    }
  }, [searchParams])

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

  const refreshMarker = useCallback(
    async (projectId: string) => {
      try {
        await refreshProjectOnMap(projectId)
      } catch {
        // Barva se obnoví při příštím načtení stránky.
      }
    },
    [refreshProjectOnMap]
  )

  const handleReplenishLocation = useCallback(
    async (item: ProjectMapMarkerWithOrder) => {
      backfilledIdsRef.current.delete(item.project_id)
      setReplenishingId(item.project_id)
      try {
        const result = await replenishProjectMapLocation(item.order)
        if (result.hasGps) {
          await refreshProjectOnMap(item.project_id)
        }
      } finally {
        setReplenishingId(null)
      }
    },
    [refreshProjectOnMap]
  )

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
        canApproveDiaryEntry: canApproveDiary,
        onDiaryChanged: async () => {
          setDiaryRefreshToken((token) => token + 1)
          await refreshMarker(selectedItem.project_id)
        },
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

      {backfilling ? (
        <p className="mb-4 text-sm text-theme-muted">Doplňuji polohy zakázek z adres…</p>
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

      {canManageNotifications ? (
        <div className="mb-4">
          <ProjectNotificationsPanel canRunCheck diaryFillBasePath="/denik" />
        </div>
      ) : null}

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
              replenishingId={replenishingId}
              onReplenishLocation={handleReplenishLocation}
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

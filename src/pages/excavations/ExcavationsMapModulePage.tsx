import { useCallback, useEffect, useState } from 'react'
import {
  Eraser,
  FileDown,
  MousePointer2,
  Pencil,
  PenLine,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  ExcavationMapEditor,
  type ExcavationDrawMode,
  type MapFocusTarget,
} from '@/components/excavations/ExcavationMapEditor'
import {
  ExcavationStartPanel,
  type MapStartFocus,
} from '@/components/excavations/ExcavationStartPanel'
import { ExcavationModeSelector } from '@/components/excavations/ExcavationModeSelector'
import {
  GpsWalkMeasurementPanel,
  type GpsWalkResult,
} from '@/components/excavations/GpsWalkMeasurementPanel'
import {
  AddressRouteMeasurementPanel,
  type AddressRouteResult,
} from '@/components/excavations/AddressRouteMeasurementPanel'
import { RouteSegmentList } from '@/components/excavations/RouteSegmentList'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import {
  createExcavationRoute,
  deleteExcavationRoute,
  fetchExcavationRoutes,
  updateExcavationRoute,
} from '@/lib/excavations/api'
import {
  calculateRouteLengthMeters,
  formatRouteLength,
  getRouteMapUrl,
} from '@/lib/excavations/geometry'
import {
  buildExcavationReportDocument,
  downloadExcavationReport,
  printExcavationReport,
} from '@/lib/excavations/excavationReport'
import { downloadHtmlDocument } from '@/lib/print/printDocument'
import { fetchJobOrders } from '@/lib/orders/api'
import type { ExcavationPoint, ExcavationRoute, MeasurementMode } from '@/types/excavations'
import { MEASUREMENT_MODE_LABELS, pickRouteColor } from '@/types/excavations'
import { formatDate } from '@/constants/workers'

export function ExcavationsMapModulePage() {
  const { user } = useAuth()
  const { settings: company } = useCompanySettings()
  const [routes, setRoutes] = useState<ExcavationRoute[]>([])
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [filterOrderId, setFilterOrderId] = useState('')
  const [drawOrderId, setDrawOrderId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [measurementMode, setMeasurementMode] = useState<MeasurementMode | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawMode, setDrawMode] = useState<ExcavationDrawMode>('points')
  const [draftPoints, setDraftPoints] = useState<ExcavationPoint[]>([])
  const [routeName, setRouteName] = useState('')
  const [routeNote, setRouteNote] = useState('')
  const [startLabel, setStartLabel] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const [mapFocus, setMapFocus] = useState<MapFocusTarget | null>(null)
  const [userLocation, setUserLocation] = useState<MapFocusTarget | null>(null)

  const draftLength = calculateRouteLengthMeters(draftPoints)
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null
  const showSaveForm = draftPoints.length >= 2 && !isDrawing
  const isMeasuring = measurementMode != null && (isDrawing || draftPoints.length > 0)
  const showGpsDetails = measurementMode === 'gps_walk' || measurementMode === 'address_route'

  useEffect(() => {
    fetchJobOrders().then((orders) => {
      const opts = orders.map((o) => ({ value: o.id, label: o.name }))
      setOrderOptions([{ value: '', label: '— Vyberte zakázku —' }, ...opts])
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRoutes(await fetchExcavationRoutes({ orderId: filterOrderId || undefined }))
    } finally {
      setLoading(false)
    }
  }, [filterOrderId])

  useEffect(() => {
    void load()
  }, [load])

  function resetMeasurement() {
    setMeasurementMode(null)
    setIsDrawing(false)
    setDraftPoints([])
    setRouteName('')
    setRouteNote('')
    setStartLabel('')
    setEditingRouteId(null)
    setMapFocus(null)
    setUserLocation(null)
    setDrawMode('points')
    setError('')
  }

  function handleModeSelect(mode: MeasurementMode) {
    if (!drawOrderId) {
      setError('Nejdříve vyberte zakázku pro měření.')
      return
    }
    setError('')
    setMeasurementMode(mode)
    setDraftPoints([])
    setIsDrawing(false)
    setSelectedRouteId(null)
    setEditingRouteId(null)
  }

  function handleMapReady(focus: MapStartFocus) {
    if (!drawOrderId) {
      setError('Nejdříve vyberte zakázku pro měření.')
      return
    }
    setError('')
    setStartLabel(focus.label)
    setMapFocus({
      lat: focus.lat,
      lng: focus.lng,
      zoom: focus.zoom,
      accuracy: focus.accuracy,
    })
    setUserLocation(
      focus.accuracy != null
        ? { lat: focus.lat, lng: focus.lng, accuracy: focus.accuracy }
        : null
    )
    setDraftPoints([])
    setIsDrawing(true)
    setEditingRouteId(null)
    setSelectedRouteId(null)
  }

  function handleGpsWalkComplete(result: GpsWalkResult) {
    setError('')
    setStartLabel(result.label)
    setDraftPoints(result.points)
    setMapFocus(result.mapFocus)
    setUserLocation(null)
    setIsDrawing(false)
    if (!routeName.trim()) {
      setRouteName('Měření chůzí')
    }
  }

  function handleAddressRouteComplete(result: AddressRouteResult) {
    setError('')
    setStartLabel(result.label)
    setDraftPoints(result.points)
    setMapFocus(result.mapFocus)
    setUserLocation(null)
    setIsDrawing(false)
    if (!routeName.trim()) {
      setRouteName('Měření od–do')
    }
  }

  function cancelDrawing() {
    resetMeasurement()
  }

  function finishMeasurement() {
    if (draftPoints.length < 2) {
      setError('Trasa musí mít alespoň 2 body (start a konec).')
      return
    }
    setError('')
    setIsDrawing(false)
  }

  function handleMapClick(point: ExcavationPoint) {
    if (!isDrawing) return
    setDraftPoints((prev) => [...prev, point])
  }

  function deletePoint(index: number) {
    setDraftPoints((prev) => prev.filter((_, i) => i !== index))
  }

  function undoLastPoint() {
    setDraftPoints((prev) => prev.slice(0, -1))
  }

  function clearAllPoints() {
    setDraftPoints([])
  }

  function startEditRoute(route: ExcavationRoute) {
    setEditingRouteId(route.id)
    setSelectedRouteId(route.id)
    setDrawOrderId(route.order_id)
    setDraftPoints([...route.points])
    setRouteName(route.name)
    setRouteNote(route.note ?? '')
    setStartLabel(route.order_name ?? '')
    setMeasurementMode('manual')
    setIsDrawing(true)
    setDrawMode('points')
    if (route.points[0]) {
      setMapFocus({
        lat: route.points[0].lat,
        lng: route.points[0].lng,
        zoom: 18,
      })
    }
  }

  function downloadDraftReport() {
    const orderName = orderOptions.find((o) => o.value === drawOrderId)?.label ?? ''
    const draftRoute: ExcavationRoute = {
      id: 'draft',
      order_id: drawOrderId,
      name: routeName.trim() || 'Návrh měření',
      note: routeNote || null,
      color: pickRouteColor(routes.length),
      points: draftPoints,
      total_length_m: draftLength,
      created_by: user?.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      order_name: orderName,
      creator_name: user?.email,
    }
    const modeLabel = measurementMode ? MEASUREMENT_MODE_LABELS[measurementMode] : ''
    if (modeLabel && !draftRoute.note) {
      draftRoute.note = `Režim: ${modeLabel}`
    }
    downloadHtmlDocument(
      buildExcavationReportDocument(draftRoute, company),
      `vykop_navrh_${draftRoute.name.replace(/\s+/g, '_')}.html`
    )
  }

  async function handleSave() {
    if (!user) return
    if (!drawOrderId) {
      setError('Vyberte zakázku.')
      return
    }
    if (draftPoints.length < 2) {
      setError('Trasa musí mít alespoň 2 GPS body.')
      return
    }
    if (!routeName.trim()) {
      setError('Zadejte název trasy (např. Přípojka č. 1).')
      return
    }

    setSaving(true)
    setError('')
    try {
      const modeNote = measurementMode
        ? `Režim: ${MEASUREMENT_MODE_LABELS[measurementMode]}`
        : ''
      const combinedNote = [modeNote, routeNote.trim()].filter(Boolean).join('\n')

      const payload = {
        order_id: drawOrderId,
        name: routeName.trim(),
        note: combinedNote || undefined,
        color: editingRouteId
          ? routes.find((r) => r.id === editingRouteId)?.color ?? pickRouteColor(routes.length)
          : pickRouteColor(routes.length),
        points: draftPoints,
        total_length_m: calculateRouteLengthMeters(draftPoints),
      }

      if (editingRouteId) {
        await updateExcavationRoute(editingRouteId, payload)
      } else {
        await createExcavationRoute(payload, user.id)
      }

      resetMeasurement()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(route: ExcavationRoute) {
    if (!confirm(`Smazat trasu „${route.name}"?`)) return
    setSaving(true)
    try {
      await deleteExcavationRoute(route.id)
      if (selectedRouteId === route.id) setSelectedRouteId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Smazání se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <PageHeader
        title="Mapa výkopů"
        description="Měření trasy ve třech režimech: ruční kreslení na mapě, měření chůzí podle GPS, nebo měření podle adresy od–do. Vše lze uložit k zakázce."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Zakázka pro měření"
                options={orderOptions}
                value={drawOrderId}
                onChange={(e) => setDrawOrderId(e.target.value)}
              />
              <Select
                label="Filtr zobrazených tras"
                options={[{ value: '', label: 'Všechny zakázky' }, ...orderOptions.slice(1)]}
                value={filterOrderId}
                onChange={(e) => setFilterOrderId(e.target.value)}
              />
            </div>

            {!isMeasuring && !editingRouteId && (
              <div className="mt-4 space-y-4">
                <ExcavationModeSelector
                  selectedMode={measurementMode}
                  disabled={!drawOrderId}
                  onSelectMode={handleModeSelect}
                />

                {measurementMode === 'manual' && (
                  <ExcavationStartPanel
                    disabled={!drawOrderId}
                    onMapReady={handleMapReady}
                  />
                )}

                {measurementMode === 'gps_walk' && (
                  <GpsWalkMeasurementPanel
                    disabled={!drawOrderId}
                    onComplete={handleGpsWalkComplete}
                    onCancel={cancelDrawing}
                  />
                )}

                {measurementMode === 'address_route' && (
                  <AddressRouteMeasurementPanel
                    disabled={!drawOrderId}
                    onComplete={handleAddressRouteComplete}
                    onCancel={cancelDrawing}
                  />
                )}
              </div>
            )}

            {isDrawing && measurementMode === 'manual' && (
              <div className="mt-4 space-y-3">
                {startLabel && (
                  <p className="text-sm text-theme-secondary">
                    <span className="text-theme-muted">Místo měření: </span>
                    {startLabel}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={drawMode === 'points' ? 'primary' : 'secondary'}
                    onClick={() => setDrawMode('points')}
                  >
                    <MousePointer2 className="h-4 w-4" />
                    Body / tečky
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={drawMode === 'freehand' ? 'primary' : 'secondary'}
                    onClick={() => setDrawMode('freehand')}
                  >
                    <PenLine className="h-4 w-4" />
                    Kreslit čáru
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={undoLastPoint}
                    disabled={draftPoints.length === 0}
                  >
                    <Undo2 className="h-4 w-4" />
                    Zpět
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={clearAllPoints}
                    disabled={draftPoints.length === 0}
                  >
                    <Eraser className="h-4 w-4" />
                    Vymazat měření
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={finishMeasurement}
                    disabled={draftPoints.length < 2}
                  >
                    Ukončit kreslení
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={cancelDrawing}>
                    Zrušit
                  </Button>
                </div>

                <p className="text-sm text-amber-300">
                  {drawMode === 'points'
                    ? draftPoints.length === 0
                      ? 'Klikněte do mapy na začátek výkopu, poté pokračujte dalšími body.'
                      : 'Klikáním přidávejte body. Bod můžete přetáhnout na mapě.'
                    : draftPoints.length === 0
                      ? 'Držte prst nebo myš na mapě a táhněte podél trasy výkopu.'
                      : 'Táhněte podél trasy – body se přidávají automaticky.'}
                </p>
              </div>
            )}

            {showSaveForm && !isDrawing && measurementMode && (
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-sm text-theme-secondary">
                  <span className="text-theme-muted">Režim: </span>
                  {MEASUREMENT_MODE_LABELS[measurementMode]}
                  {startLabel && (
                    <>
                      <span className="text-theme-muted"> · </span>
                      {startLabel}
                    </>
                  )}
                </p>
                <Button type="button" size="sm" variant="secondary" onClick={cancelDrawing}>
                  Nové měření
                </Button>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </Card>

          <ExcavationMapEditor
            routes={routes}
            draftPoints={draftPoints}
            isDrawing={isDrawing}
            drawMode={drawMode}
            selectedRouteId={selectedRouteId}
            mapFocus={mapFocus}
            userLocation={userLocation}
            onMapClick={handleMapClick}
            onDraftPointsChange={setDraftPoints}
            onSelectRoute={setSelectedRouteId}
          />

          {(isDrawing || draftPoints.length > 0) && (
            <Card>
              <h3 className="mb-3 font-semibold text-theme-primary">Délka trasy</h3>
              <RouteSegmentList
                points={draftPoints}
                showDelete={isDrawing && measurementMode === 'manual'}
                showGpsDetails={showGpsDetails}
                onDeletePoint={deletePoint}
              />
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {showSaveForm && (
            <Card>
              <h3 className="mb-3 font-semibold text-theme-primary">Uložit trasu k zakázce</h3>
              <div className="space-y-3">
                <Input
                  label="Název trasy"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Přípojka č. 1"
                />
                <Textarea
                  label="Poznámka"
                  value={routeNote}
                  onChange={(e) => setRouteNote(e.target.value)}
                  rows={2}
                />
                <p className="text-sm font-bold text-emerald-400">
                  Délka výkopu: {formatRouteLength(draftLength)}
                </p>
                <Button type="button" loading={saving} onClick={handleSave} className="w-full">
                  <Save className="h-4 w-4" />
                  Uložit trasu
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={downloadDraftReport}
                  className="w-full"
                >
                  <FileDown className="h-4 w-4" />
                  Exportovat do PDF
                </Button>
              </div>
            </Card>
          )}

          {selectedRoute && !isMeasuring && (
            <Card>
              <h3 className="mb-2 font-semibold text-theme-primary">{selectedRoute.name}</h3>
              <dl className="space-y-1 text-sm">
                <div><dt className="text-theme-muted">Zakázka</dt><dd>{selectedRoute.order_name}</dd></div>
                <div><dt className="text-theme-muted">Délka</dt><dd className="font-bold text-emerald-400">{formatRouteLength(selectedRoute.total_length_m)}</dd></div>
                <div><dt className="text-theme-muted">Datum</dt><dd>{formatDate(selectedRoute.created_at.slice(0, 10))}</dd></div>
                <div><dt className="text-theme-muted">Vytvořil</dt><dd>{selectedRoute.creator_name ?? '—'}</dd></div>
                {selectedRoute.note && <div><dt className="text-theme-muted">Poznámka</dt><dd className="whitespace-pre-line">{selectedRoute.note}</dd></div>}
              </dl>
              <div className="mt-4 flex flex-col gap-2">
                <a href={getRouteMapUrl(selectedRoute.points)} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
                  Otevřít street mapu
                </a>
                <Button type="button" variant="secondary" size="sm" onClick={() => startEditRoute(selectedRoute)}>
                  <Pencil className="h-4 w-4" />
                  Upravit body
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => downloadExcavationReport(selectedRoute, company)}>
                  <FileDown className="h-4 w-4" />
                  PDF doklad
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => printExcavationReport(selectedRoute, company)}>
                  Tisk PDF
                </Button>
                <Button type="button" variant="danger" size="sm" loading={saving} onClick={() => handleDelete(selectedRoute)}>
                  <Trash2 className="h-4 w-4" />
                  Smazat trasu
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <h3 className="mb-3 font-semibold text-theme-primary">
              Uložené trasy {loading ? '…' : `(${routes.length})`}
            </h3>
            {routes.length === 0 ? (
              <p className="text-sm text-theme-muted">
                Zatím žádné trasy. Vyberte zakázku a zvolte režim měření: ruční kreslení, GPS chůze, nebo adresy od–do.
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto scrollbar-premium">
                {routes.map((route) => (
                  <li key={route.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRouteId(route.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                        selectedRouteId === route.id
                          ? 'border-[var(--accent-primary)] bg-white/5'
                          : 'border-[var(--border-glass)] hover:bg-white/5'
                      }`}
                    >
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: route.color }} />
                      <span className="font-medium text-theme-primary">{route.name}</span>
                      <span className="mt-0.5 block text-xs text-theme-muted">
                        {route.order_name} · {formatRouteLength(route.total_length_m)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

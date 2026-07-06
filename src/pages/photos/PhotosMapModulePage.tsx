import { useCallback, useEffect, useState } from 'react'

import { MapPin } from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'

import { PageHeader } from '@/components/ui/PageHeader'

import { Card } from '@/components/ui/Card'

import { Input } from '@/components/ui/Input'

import { Select } from '@/components/ui/Select'

import { ConstructionPointMapView } from '@/components/constructionPoints/ConstructionPointMapView'

import { ConstructionPointDetailPanel } from '@/components/constructionPoints/ConstructionPointDetailPanel'

import { fetchConstructionPoints } from '@/lib/constructionPoints/api'

import { fetchJobOrders } from '@/lib/orders/api'

import { fetchWorkers } from '@/lib/workers/api'

import type { ConstructionPointFilters } from '@/types/constructionPoints'



export function PhotosMapModulePage() {

  const [points, setPoints] = useState<Awaited<ReturnType<typeof fetchConstructionPoints>>>([])

  const [filters, setFilters] = useState<ConstructionPointFilters>({})

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)

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

      setPoints(await fetchConstructionPoints(filters))

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

        title="Fotky na mapě"

        description="Každá tečka je stavební bod s kompletní historií fotografií a poznámek. První GPS fotografie automaticky vytvoří nový bod."

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



        <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-glass)] pt-4 text-sm text-theme-secondary">

          <MapPin className="h-4 w-4 text-accent" />

          {loading

            ? 'Načítám mapu…'

            : `${points.length} ${points.length === 1 ? 'stavební bod' : points.length < 5 ? 'stavební body' : 'stavebních bodů'} · Mapa / Satelit · klepněte na tečku pro detail`}

        </p>

      </Card>



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

          <>

            <ConstructionPointDetailPanel

              pointId={selectedPointId}

              onClose={() => setSelectedPointId(null)}

              onUpdated={load}

              variant="sidebar"

            />

            <ConstructionPointDetailPanel

              pointId={selectedPointId}

              onClose={() => setSelectedPointId(null)}

              onUpdated={load}

              variant="sheet"

            />

          </>

        )}

      </div>

    </AppLayout>

  )

}



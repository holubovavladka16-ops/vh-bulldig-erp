import { useCallback, useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { FotoMapView } from '@/components/fotodokumentace/FotoMapView'
import { FotoDetailModal } from '@/components/fotodokumentace/FotoDetailModal'
import { fetchFotodokumenty } from '@/lib/fotodokumentace/api'
import { fetchJobOrders } from '@/lib/orders/api'
import type { FotoDokument, FotoFiltry } from '@/types/fotodokumentace'

export function FotodokumentaceMapPage() {
  const [fotografie, setFotografie] = useState<FotoDokument[]>([])
  const [filters, setFilters] = useState<FotoFiltry>({ hasGps: true })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [orderOptions, setOrderOptions] = useState([{ value: '', label: 'Všechny zakázky' }])

  const load = useCallback(async () => {
    setFotografie(await fetchFotodokumenty(filters))
  }, [filters])

  useEffect(() => {
    fetchJobOrders().then((orders) =>
      setOrderOptions([
        { value: '', label: 'Všechny zakázky' },
        ...orders.map((o) => ({ value: o.id, label: o.name })),
      ])
    )
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = fotografie.find((f) => f.id === selectedId) ?? null

  return (
    <AppLayout>
      <PageHeader
        title="Fotky na mapě"
        description="Fotografie s GPS polohou zobrazené na mapě."
      />

      <Card className="mb-4 max-w-md">
        <Select
          label="Filtrovat podle zakázky"
          value={filters.orderId ?? ''}
          onChange={(e) => setFilters({ ...filters, orderId: e.target.value || undefined })}
          options={orderOptions}
        />
      </Card>

      <FotoMapView
        fotografie={fotografie}
        selectedId={selectedId}
        onSelect={setSelectedId}
        fullHeight
      />

      <FotoDetailModal
        foto={selected}
        onClose={() => setSelectedId(null)}
        onUpdated={load}
      />
    </AppLayout>
  )
}

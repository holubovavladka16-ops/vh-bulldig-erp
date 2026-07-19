import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Camera, LayoutGrid, List, Loader2, Map } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  FotoCaptureScreen,
  type FotoCaptureResult,
} from '@/components/fotodokumentace/FotoCaptureScreen'
import { FotoSavePanel } from '@/components/fotodokumentace/FotoSavePanel'
import { FotoKarta } from '@/components/fotodokumentace/FotoKarta'
import { FotoDetailModal } from '@/components/fotodokumentace/FotoDetailModal'
import { FotoFiltryPanel } from '@/components/fotodokumentace/FotoFiltryPanel'
import { FotoMapView } from '@/components/fotodokumentace/FotoMapView'
import { useAuth } from '@/context/AuthContext'
import { useOfflineSync } from '@/hooks/fotodokumentace/useOfflineSync'
import { fetchFotodokumenty } from '@/lib/fotodokumentace/api'
import { fetchJobOrders } from '@/lib/orders/api'
import { fetchWorkers } from '@/lib/workers/api'
import type { FotoDokument, FotoFiltry } from '@/types/fotodokumentace'

type HlavniPohled = 'capture' | 'save' | 'gallery'
type GaleriePohled = 'grid' | 'list' | 'map'

export function FotodokumentacePage() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const creatorName = profile?.full_name?.trim() || user?.email || '—'

  const [pohled, setPohled] = useState<HlavniPohled>('capture')
  const [galeriePohled, setGaleriePohled] = useState<GaleriePohled>('grid')
  const [capture, setCapture] = useState<FotoCaptureResult | null>(null)
  const [fotografie, setFotografie] = useState<FotoDokument[]>([])
  const [filters, setFilters] = useState<FotoFiltry>({})
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [orderOptions, setOrderOptions] = useState([{ value: '', label: 'Všechny zakázky' }])
  const [workerOptions, setWorkerOptions] = useState([{ value: '', label: 'Všichni' }])

  const defaultOrderId = searchParams.get('zakazka') ?? undefined

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setFotografie(await fetchFotodokumenty(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useOfflineSync(load)

  useEffect(() => {
    Promise.all([
      fetchJobOrders().then((orders) => [
        { value: '', label: 'Všechny zakázky' },
        ...orders.map((o) => ({ value: o.id, label: o.name })),
      ]),
      fetchWorkers('aktivni').then((workers) => [
        { value: '', label: 'Všichni' },
        ...workers.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` })),
      ]),
    ]).then(([orders, workers]) => {
      setOrderOptions(orders)
      setWorkerOptions(workers)
    })
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    const fotoId = searchParams.get('foto')
    if (fotoId) {
      setSelectedId(fotoId)
      setPohled('gallery')
    }
  }, [searchParams])

  function handleCaptured(result: FotoCaptureResult) {
    setCapture(result)
    setPohled('save')
  }

  function handleSaved() {
    setCapture(null)
    setPohled('gallery')
    void load()
  }

  const selectedFoto = fotografie.find((f) => f.id === selectedId) ?? null

  return (
    <AppLayout>
      <PageHeader
        title="Fotodokumentace s GPS"
        description="Nejdříve pořiďte fotografii, poté se načte GPS a adresa. Zakázku a poznámku doplníte až na konci."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={pohled === 'capture' || pohled === 'save' ? 'primary' : 'secondary'}
          onClick={() => {
            setCapture(null)
            setPohled('capture')
          }}
        >
          <Camera className="h-4 w-4" />
          Pořídit fotografii
        </Button>
        <Button
          size="sm"
          variant={pohled === 'gallery' ? 'primary' : 'secondary'}
          onClick={() => setPohled('gallery')}
        >
          <LayoutGrid className="h-4 w-4" />
          Galerie
        </Button>
      </div>

      {(pohled === 'capture' || pohled === 'save') && (
        <Card className="mb-6">
          {pohled === 'capture' && user && (
            <FotoCaptureScreen
              active
              onCaptured={handleCaptured}
              onCancel={() => setPohled('gallery')}
            />
          )}
          {pohled === 'save' && capture && user && (
            <FotoSavePanel
              capture={capture}
              uploadedBy={user.id}
              creatorName={creatorName}
              defaultOrderId={defaultOrderId}
              lockOrder={Boolean(defaultOrderId)}
              onSaved={handleSaved}
              onCancel={() => {
                setCapture(null)
                setPohled('capture')
              }}
            />
          )}
        </Card>
      )}

      {pohled === 'gallery' && (
        <>
          <Card className="mb-4">
            <FotoFiltryPanel
              filters={filters}
              onChange={setFilters}
              orderOptions={orderOptions}
              workerOptions={workerOptions}
            />
          </Card>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button size="sm" variant={galeriePohled === 'grid' ? 'primary' : 'secondary'} onClick={() => setGaleriePohled('grid')}>
              <LayoutGrid className="h-4 w-4" />Mřížka
            </Button>
            <Button size="sm" variant={galeriePohled === 'list' ? 'primary' : 'secondary'} onClick={() => setGaleriePohled('list')}>
              <List className="h-4 w-4" />Seznam
            </Button>
            <Button size="sm" variant={galeriePohled === 'map' ? 'primary' : 'secondary'} onClick={() => setGaleriePohled('map')}>
              <Map className="h-4 w-4" />Mapa
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-theme-muted" />
            </div>
          ) : galeriePohled === 'map' ? (
            <FotoMapView
              fotografie={fotografie}
              selectedId={selectedId}
              onSelect={setSelectedId}
              fullHeight
            />
          ) : (
            <div className={galeriePohled === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-2'}>
              {fotografie.length === 0 ? (
                <p className="col-span-full py-12 text-center text-theme-muted">Zatím žádné fotografie.</p>
              ) : (
                fotografie.map((foto) => (
                  <FotoKarta
                    key={foto.id}
                    foto={foto}
                    view={galeriePohled}
                    onClick={() => setSelectedId(foto.id)}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      <FotoDetailModal
        foto={selectedFoto}
        onClose={() => setSelectedId(null)}
        onUpdated={load}
      />
    </AppLayout>
  )
}

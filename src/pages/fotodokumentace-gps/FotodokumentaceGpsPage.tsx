import { useCallback, useEffect, useState } from 'react'
import { Camera, FileText, Link as LinkIcon, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { FdgCaptureFlow } from '@/components/fotodokumentace-gps/FdgCaptureFlow'
import { FdgSavePanel } from '@/components/fotodokumentace-gps/FdgSavePanel'
import { FdgGalleryCard } from '@/components/fotodokumentace-gps/FdgGalleryCard'
import { FdgFiltersPanel } from '@/components/fotodokumentace-gps/FdgFiltersPanel'
import { FdgDetailModal } from '@/components/fotodokumentace-gps/FdgDetailModal'
import { downloadGpsFotodokladPdf } from '@/lib/fotodokumentace-gps/gpsFotodokladPdf'
import { fetchModulePhotos, syncOfflinePhotos } from '@/lib/fotodokumentace-gps/service'
import { fetchJobOrders } from '@/lib/orders/api'
import { fetchWorkers } from '@/lib/workers/api'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { FdgFilters, FdgPendingCapture } from '@/types/fotodokumentaceGps'
import type { GpsPhoto } from '@/types/photos'

type FlowStep = 'gallery' | 'capture' | 'save'

export function FotodokumentaceGpsPage() {
  const { user } = useAuth()
  const { settings: company } = useCompanySettings()
  const [step, setStep] = useState<FlowStep>('gallery')
  const [pendingCapture, setPendingCapture] = useState<FdgPendingCapture | null>(null)
  const [photos, setPhotos] = useState<GpsPhoto[]>([])
  const [filters, setFilters] = useState<FdgFilters>({})
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [workerOptions, setWorkerOptions] = useState<{ value: string; label: string }[]>([])
  const [detailPhoto, setDetailPhoto] = useState<GpsPhoto | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPhotos(await fetchModulePhotos(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!user) return
    const sync = () => {
      void syncOfflinePhotos(user.id).then((n) => {
        if (n > 0) void load()
      })
    }
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [user, load])

  useEffect(() => {
    void fetchJobOrders().then((orders) => setOrderOptions(orders.map((o) => ({ value: o.id, label: o.name }))))
    void fetchWorkers('vse').then((workers) =>
      setWorkerOptions(workers.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` })))
    )
  }, [])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleBulkPdf() {
    const selected = photos.filter((p) => selectedIds.includes(p.id))
    if (selected.length === 0) return
    await downloadGpsFotodokladPdf(selected, company)
  }

  return (
    <AppLayout>
      <PageHeader
        title="Fotodokumentace s GPS"
        description="Modul 13 – pořizování fotografií se zakázkou, GPS a PDF fotodokladem A4"
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/fotodokumentace/mapa">
              <Button variant="secondary" size="sm">
                <MapPin className="h-4 w-4" />
                Mapa
              </Button>
            </Link>
            {step === 'gallery' && (
              <Button size="sm" onClick={() => setStep('capture')}>
                <Camera className="h-4 w-4" />
                Pořídit fotografii
              </Button>
            )}
          </div>
        }
      />

      {step === 'capture' && (
        <FdgCaptureFlow
          onConfirm={(capture) => {
            setPendingCapture(capture)
            setStep('save')
          }}
          onCancel={() => setStep('gallery')}
        />
      )}

      {step === 'save' && pendingCapture && user && (
        <FdgSavePanel
          capture={pendingCapture}
          userId={user.id}
          onSaved={() => {
            setPendingCapture(null)
            setStep('gallery')
            void load()
          }}
          onCancel={() => {
            URL.revokeObjectURL(pendingCapture.previewUrl)
            setPendingCapture(null)
            setStep('gallery')
          }}
        />
      )}

      {step === 'gallery' && (
        <div className="space-y-4">
          <FdgFiltersPanel
            filters={filters}
            orderOptions={orderOptions}
            workerOptions={workerOptions}
            onChange={setFilters}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectMode ? 'primary' : 'secondary'}
              onClick={() => {
                setSelectMode(!selectMode)
                setSelectedIds([])
              }}
            >
              {selectMode ? 'Zrušit výběr' : 'Vybrat fotografie'}
            </Button>
            {selectMode && selectedIds.length > 0 && (
              <Button size="sm" onClick={handleBulkPdf}>
                <FileText className="h-4 w-4" />
                PDF ({selectedIds.length} stran A4)
              </Button>
            )}
          </div>

          {loading ? (
            <p className="text-theme-muted">Načítám galerii…</p>
          ) : photos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-glass)] p-8 text-center">
              <p className="text-theme-muted">Zatím žádné fotografie.</p>
              <Button className="mt-4" onClick={() => setStep('capture')}>
                <Camera className="h-4 w-4" />
                Pořídit první fotografii
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {photos.map((photo) => (
                <FdgGalleryCard
                  key={photo.id}
                  photo={photo}
                  selectMode={selectMode}
                  selected={selectedIds.includes(photo.id)}
                  onClick={() => setDetailPhoto(photo)}
                  onToggleSelect={() => toggleSelect(photo.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <FdgDetailModal
        photo={detailPhoto}
        onClose={() => setDetailPhoto(null)}
        onUpdated={() => void load()}
      />

      <p className="mt-8 flex items-center gap-2 text-xs text-theme-muted">
        <LinkIcon className="h-3 w-3" />
        Mapové odkazy: Mapy.cz · Google Maps · Street View v detailu a PDF
      </p>
    </AppLayout>
  )
}

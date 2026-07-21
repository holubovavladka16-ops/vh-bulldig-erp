import { useCallback, useEffect, useState } from 'react'
import { Camera, FileDown, Images, Map } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { GfaLocationMap } from '@/components/gpsFotoarchiv/GfaLocationMap'
import { GfaCapturePanel } from '@/components/gpsFotoarchiv/GfaCapturePanel'
import { GfaFiltersBar } from '@/components/gpsFotoarchiv/GfaFiltersBar'
import { GfaGalleryCard } from '@/components/gpsFotoarchiv/GfaGalleryCard'
import { GfaDetailModal } from '@/components/gpsFotoarchiv/GfaDetailModal'
import { useAuth } from '@/context/AuthContext'
import { useGpsPreflight } from '@/hooks/useGpsPreflight'
import { isAdministrator } from '@/constants/permissions'
import {
  GPS_FOTOARCHIV_LABEL,
  GPS_FOTOARCHIV_MAX_ACCURACY_METERS,
  GPS_FOTOARCHIV_VIEW_LABELS,
  type GpsFotoarchivView,
} from '@/constants/gpsFotoarchiv'
import { fetchArchivePhotos, fetchAuthorOptions } from '@/lib/gpsFotoarchiv/service'
import { exportArchivePhotosPdf } from '@/lib/gpsFotoarchiv/pdfExport'
import { fetchJobOrders } from '@/lib/orders/api'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { GpsFotoarchivFilters } from '@/types/gpsFotoarchiv'
import type { GpsPhoto } from '@/types/photos'

const VIEW_ICONS: Record<GpsFotoarchivView, typeof Camera> = {
  capture: Camera,
  gallery: Images,
  map: Map,
}

export function GpsFotoarchivPage() {
  const { user, profile } = useAuth()
  const { settings } = useCompanySettings()
  const isAdmin = profile ? isAdministrator(profile.role) : false

  const [view, setView] = useState<GpsFotoarchivView>('capture')
  const [photos, setPhotos] = useState<GpsPhoto[]>([])
  const [filters, setFilters] = useState<GpsFotoarchivFilters>({})
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [authorOptions, setAuthorOptions] = useState<{ value: string; label: string }[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [locationArmed, setLocationArmed] = useState(false)

  const captureGps = useGpsPreflight(locationArmed, {
    maxAccuracyMeters: GPS_FOTOARCHIV_MAX_ACCURACY_METERS,
    requireAddressLoaded: true,
  })
  const mapGps = useGpsPreflight(view === 'map')

  useEffect(() => {
    if (view !== 'capture') {
      setLocationArmed(false)
    }
  }, [view])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPhotos(await fetchArchivePhotos(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchJobOrders()
      .then((orders) => setOrderOptions(orders.map((o) => ({ value: o.id, label: o.name }))))
      .catch(() => {})
    fetchAuthorOptions()
      .then(setAuthorOptions)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250)
    return () => clearTimeout(timeout)
  }, [load])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectedPhotos = photos.filter((p) => selectedIds.includes(p.id))

  return (
    <AppLayout>
      <PageHeader
        title={GPS_FOTOARCHIV_LABEL}
        description={`Profesionální archiv fotografií s přesnou polohou. Klepněte pro zaměření GPS, počkejte na adresu a souřadnice (±${GPS_FOTOARCHIV_MAX_ACCURACY_METERS} m), poté vyfotíte a uložíte.`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(GPS_FOTOARCHIV_VIEW_LABELS) as GpsFotoarchivView[]).map((key) => {
          const Icon = VIEW_ICONS[key]
          return (
            <Button
              key={key}
              variant={view === key ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setView(key)}
            >
              <Icon className="h-4 w-4" />
              {GPS_FOTOARCHIV_VIEW_LABELS[key]}
            </Button>
          )
        })}
        {selectedPhotos.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void exportArchivePhotosPdf(selectedPhotos, settings)}
          >
            <FileDown className="h-4 w-4" />
            Export PDF ({selectedPhotos.length})
          </Button>
        )}
      </div>

      {view === 'capture' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GfaLocationMap
            userLat={captureGps.position?.lat}
            userLng={captureGps.position?.lng}
            userAccuracy={captureGps.position?.accuracy}
            photos={photos.slice(0, 20)}
            fullHeight
          />
          {user && (
            <GfaCapturePanel
              userId={user.id}
              orderOptions={orderOptions}
              gps={captureGps}
              locationArmed={locationArmed}
              onArmLocation={() => setLocationArmed(true)}
              onResetLocation={() => setLocationArmed(false)}
              onSaved={() => {
                void load()
                setView('gallery')
              }}
            />
          )}
        </div>
      )}

      {view === 'gallery' && (
        <>
          <GfaFiltersBar
            filters={filters}
            orderOptions={orderOptions}
            authorOptions={authorOptions}
            onChange={setFilters}
          />
          {loading ? (
            <Card className="p-6 text-sm text-[var(--text-muted)]">Načítám galerii…</Card>
          ) : photos.length === 0 ? (
            <Card className="p-6 text-sm text-[var(--text-muted)]">Zatím žádné fotografie.</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative">
                  {isAdmin && (
                    <label className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded bg-black/50 px-2 py-1 text-xs text-white">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(photo.id)}
                        onChange={() => toggleSelect(photo.id)}
                      />
                      PDF
                    </label>
                  )}
                  <GfaGalleryCard
                    photo={photo}
                    selected={detailId === photo.id}
                    onClick={() => setDetailId(photo.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'map' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <GfaLocationMap
            userLat={mapGps.position?.lat}
            userLng={mapGps.position?.lng}
            userAccuracy={mapGps.position?.accuracy}
            photos={photos}
            selectedPhotoId={detailId}
            onPhotoSelect={setDetailId}
            fullHeight
          />
          <Card className="max-h-[70vh] overflow-y-auto p-3">
            <p className="mb-3 text-sm text-[var(--text-muted)]">
              Klikněte na špendlík pro detail fotografie.
            </p>
            <div className="space-y-2">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setDetailId(photo.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    detailId === photo.id ? 'border-lime-400/60 bg-lime-400/10' : 'border-[var(--border-glass)]'
                  }`}
                >
                  {photo.title?.trim() || photo.order_name || 'Fotografie'}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      <GfaDetailModal
        photoId={detailId}
        orderOptions={orderOptions}
        userId={user?.id ?? ''}
        isAdmin={isAdmin}
        onClose={() => setDetailId(null)}
        onUpdated={() => void load()}
      />
    </AppLayout>
  )
}

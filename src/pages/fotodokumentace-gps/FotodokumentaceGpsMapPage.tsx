import { useCallback, useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { PhotoMapView } from '@/components/photos/PhotoMapView'
import { FdgDetailModal } from '@/components/fotodokumentace-gps/FdgDetailModal'
import { fetchModulePhotos } from '@/lib/fotodokumentace-gps/service'
import type { GpsPhoto } from '@/types/photos'

export function FotodokumentaceGpsMapPage() {
  const [photos, setPhotos] = useState<GpsPhoto[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailPhoto, setDetailPhoto] = useState<GpsPhoto | null>(null)

  const load = useCallback(async () => {
    const all = await fetchModulePhotos({ gpsFilter: 'with_gps' })
    setPhotos(all)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setDetailPhoto(null)
      return
    }
    setDetailPhoto(photos.find((p) => p.id === selectedId) ?? null)
  }, [selectedId, photos])

  return (
    <AppLayout>
      <PageHeader
        title="Mapa fotografií"
        description="Body GPS fotografií – kliknutím otevřete detail"
      />
      <PhotoMapView
        photos={photos.filter((p) => p.gps_lat != null && p.gps_lng != null)}
        selectedPhotoId={selectedId}
        onPhotoSelect={setSelectedId}
        fullHeight
        flyToSelected
        className="min-h-[60vh] rounded-xl overflow-hidden"
      />
      <FdgDetailModal photo={detailPhoto} onClose={() => setSelectedId(null)} onUpdated={load} />
    </AppLayout>
  )
}

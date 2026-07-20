import { useRef, useState } from 'react'
import { Camera, ImagePlus, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { readExifGpsFromFile } from '@/lib/fotodokumentace-gps/geolocation'
import type { FdgPendingCapture } from '@/types/fotodokumentaceGps'

interface FdgCaptureFlowProps {
  onConfirm: (capture: FdgPendingCapture) => void
  onCancel: () => void
}

export function FdgCaptureFlow({ onConfirm, onCancel }: FdgCaptureFlowProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<FdgPendingCapture | null>(null)

  async function handleFile(file: File, fromGallery = false) {
    const previewUrl = URL.createObjectURL(file)
    let exifLat: number | null = null
    let exifLng: number | null = null
    if (fromGallery) {
      const exif = await readExifGpsFromFile(file)
      if (exif) {
        exifLat = exif.lat
        exifLng = exif.lng
      }
    }
    setPreview({
      file,
      previewUrl,
      capturedAt: new Date(file.lastModified || Date.now()),
      exifLat,
      exifLng,
    })
  }

  function handleUse() {
    if (!preview) return
    onConfirm(preview)
  }

  function handleRetake() {
    if (preview) URL.revokeObjectURL(preview.previewUrl)
    setPreview(null)
    cameraRef.current?.click()
  }

  function handleCancelAll() {
    if (preview) URL.revokeObjectURL(preview.previewUrl)
    onCancel()
  }

  if (preview) {
    return (
      <div className="space-y-4 rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-glass)] p-4">
        <img src={preview.previewUrl} alt="Náhled" className="max-h-[60vh] w-full rounded-xl object-contain" />
        <div className="grid gap-2 sm:grid-cols-3">
          <Button onClick={handleUse}>Použít fotografii</Button>
          <Button variant="secondary" onClick={handleRetake}>
            <RotateCcw className="h-4 w-4" />
            Vyfotit znovu
          </Button>
          <Button variant="ghost" onClick={handleCancelAll}>
            <X className="h-4 w-4" />
            Zrušit
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-glass)] p-4">
      <p className="text-sm text-theme-muted">
        Nejdříve pořiďte fotografii. GPS a adresa se načtou až po potvrzení náhledu.
      </p>
      <Button className="w-full" size="lg" onClick={() => cameraRef.current?.click()}>
        <Camera className="h-5 w-5" />
        Pořídit fotografii
      </Button>
      <Button variant="secondary" className="w-full" onClick={() => galleryRef.current?.click()}>
        <ImagePlus className="h-5 w-5" />
        Vybrat z galerie
      </Button>
      <Button variant="ghost" className="w-full" onClick={onCancel}>
        Zrušit
      </Button>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f, false)
          e.target.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f, true)
          e.target.value = ''
        }}
      />
    </div>
  )
}

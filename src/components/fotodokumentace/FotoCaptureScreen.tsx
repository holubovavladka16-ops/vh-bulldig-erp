import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  RotateCcw,
  SwitchCamera,
  X,
  Zap,
  ZapOff,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCameraStream } from '@/hooks/useCameraStream'
import { CameraVideoPreview } from '@/components/formCheck/CameraVideoPreview'
import '@/styles/photoMap.css'

type FotoCaptureFaze = 'camera' | 'preview'

export interface FotoCaptureResult {
  file: File
  previewUrl: string
  capturedAt: Date
}

interface FotoCaptureScreenProps {
  active: boolean
  onCaptured: (result: FotoCaptureResult) => void
  onCancel: () => void
}

export function FotoCaptureScreen({ active, onCaptured, onCancel }: FotoCaptureScreenProps) {
  const [faze, setFaze] = useState<FotoCaptureFaze>('camera')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [flashHint, setFlashHint] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [capturedAt, setCapturedAt] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [capturing, setCapturing] = useState(false)
  const capturingRef = useRef(false)

  const camera = useCameraStream({
    enabled: active && faze === 'camera',
    facingMode,
  })

  useEffect(() => {
    if (!active) return
    setFaze('camera')
    setPreviewUrl(null)
    setCapturedFile(null)
    setCapturedAt(null)
    setError('')
  }, [active])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function showPreview(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(file)
    setCapturedFile(file)
    setCapturedAt(new Date())
    setPreviewUrl(url)
    setFaze('preview')
    setError('')
    camera.stop()
  }

  async function handleCameraCapture() {
    if (capturingRef.current) return
    capturingRef.current = true
    setCapturing(true)
    setError('')
    try {
      const result = await camera.captureFrame()
      if (!result.file) {
        setError(result.error?.message ?? 'Snímek se nepodařilo pořídit.')
        return
      }
      showPreview(result.file)
    } finally {
      capturingRef.current = false
      setCapturing(false)
    }
  }

  function handleGalleryInput(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    e.target.value = ''
    if (files?.[0]) showPreview(files[0])
  }

  function handleRetake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setCapturedFile(null)
    setCapturedAt(null)
    setFaze('camera')
    setError('')
  }

  function handleConfirm() {
    if (!capturedFile || !previewUrl || !capturedAt) return
    onCaptured({ file: capturedFile, previewUrl, capturedAt })
  }

  function toggleCamera() {
    camera.stop()
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
  }

  if (!active) return null

  if (faze === 'preview' && previewUrl) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-theme-primary">Náhled fotografie</h3>
        <img
          src={previewUrl}
          alt="Náhled"
          className="mx-auto max-h-[55vh] w-full rounded-xl border border-[var(--border-glass)] object-contain"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            <X className="h-4 w-4" />
            Zrušit
          </Button>
          <Button variant="secondary" className="flex-1" onClick={handleRetake}>
            <RotateCcw className="h-4 w-4" />
            Vyfotit znovu
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleConfirm}>
            <Check className="h-4 w-4" />
            Použít fotografii
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Button>
        <p className="text-sm font-medium text-theme-primary">Pořídit fotografii</p>
        <div className="w-16" />
      </div>

      <CameraVideoPreview
        setVideoRef={camera.setVideoRef}
        phase={camera.phase}
        errorMessage={camera.errorMessage}
        isStreamReady={camera.isStreamReady}
        needsUserStart={camera.needsUserStart}
        onStart={camera.start}
        diagnostics={camera.diagnostics}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button variant="secondary" size="sm" onClick={toggleCamera} disabled={!camera.isActive}>
          <SwitchCamera className="h-4 w-4" />
          {facingMode === 'environment' ? 'Přední' : 'Zadní'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setFlashHint((v) => !v)}
          title="Blesk ovládáte v nativní aplikaci kamery"
        >
          {flashHint ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          Blesk
        </Button>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl btn-neon px-3 py-2 text-sm">
          <ImagePlus className="h-4 w-4" />
          Galerie
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleGalleryInput}
          />
        </label>
        <Button
          variant="primary"
          size="sm"
          onClick={handleCameraCapture}
          disabled={!camera.canCapture || capturing}
        >
          {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Vyfotit
        </Button>
      </div>
    </div>
  )
}

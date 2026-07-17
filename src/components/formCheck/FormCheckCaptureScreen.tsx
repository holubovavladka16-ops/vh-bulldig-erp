import { useEffect, useState, type ChangeEvent } from 'react'
import { ArrowLeft, Camera, Check, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useCameraStream } from '@/hooks/useCameraStream'
import { CameraVideoPreview } from '@/components/photos/CameraVideoPreview'
import type { FormCheckContext } from '@/types/formCheck'
import '@/styles/photoMap.css'

type CapturePhase = 'camera' | 'preview'

interface FormCheckCaptureScreenProps {
  active: boolean
  context: FormCheckContext
  onCaptured: (file: File, previewUrl: string) => void
  onCancel: () => void
}

export function FormCheckCaptureScreen({
  active,
  context,
  onCaptured,
  onCancel,
}: FormCheckCaptureScreenProps) {
  const [phase, setPhase] = useState<CapturePhase>('camera')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  const camera = useCameraStream({ enabled: active && phase === 'camera', facingMode: 'environment' })

  useEffect(() => {
    if (!active) return
    setPhase('camera')
    setPreviewUrl(null)
    setCapturedFile(null)
    setError('')
  }, [active, context.formId])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function handleCameraCapture() {
    if (!camera.canCapture) return
    const result = await camera.captureFrame()
    if (!result.file) {
      setError(result.error?.message ?? 'Snímek se nepodařilo pořídit.')
      return
    }
    showPreview(result.file)
  }

  function handleNativeCameraInput(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (selected) showPreview(selected)
  }

  function handleGalleryInput(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (selected) showPreview(selected)
  }

  function showPreview(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(file)
    setCapturedFile(file)
    setPreviewUrl(url)
    setPhase('preview')
    setError('')
    camera.stop()
  }

  function handleRetake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setCapturedFile(null)
    setPhase('camera')
    setError('')
  }

  function handleConfirmCapture() {
    if (!capturedFile || !previewUrl) return
    onCaptured(capturedFile, previewUrl)
  }

  if (!active) return null

  if (phase === 'preview' && previewUrl) {
    return (
      <Card padding={false}>
        <div className="border-b border-[var(--border-glass)] px-4 py-3 sm:px-6">
          <h3 className="text-lg font-semibold text-theme-primary">Náhled fotografie</h3>
          <p className="mt-1 text-sm text-theme-secondary">
            Zkontrolujte, že je na snímku vidět celý formulář {context.formNumber}.
          </p>
        </div>

        <div className="p-4 sm:p-6">
          <img
            src={previewUrl}
            alt={`Fotografie formuláře ${context.formNumber}`}
            className="mx-auto max-h-[60vh] w-full rounded-xl border border-[var(--border-glass)] object-contain"
          />

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onCancel}>
              Zrušit
            </Button>
            <Button variant="secondary" onClick={handleRetake}>
              Znovu vyfotit
            </Button>
            <Button onClick={handleConfirmCapture}>
              <Check className="h-4 w-4" />
              Potvrdit fotografii
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="photo-capture-flow photo-capture-flow--page">
      <div className="mb-3 flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
          Zrušit
        </Button>
        <p className="text-sm text-theme-muted">{context.formNumber}</p>
      </div>

      <Card padding={false} className="overflow-hidden">
        <div className="border-b border-[var(--border-glass)] px-4 py-3 sm:px-6">
          <h3 className="text-lg font-semibold text-theme-primary">Vyfocení formuláře</h3>
          <p className="mt-1 text-sm text-theme-secondary">
            Vyfotografujte celý papírový formulář zaměstnance {context.workerName} za období{' '}
            {context.periodLabel}.
          </p>
        </div>

        <div className="p-4 sm:p-6">
          <div className="photo-camera-shell">
            <div className="photo-camera-viewport">
              <CameraVideoPreview
                setVideoRef={camera.setVideoRef}
                phase={camera.phase}
                isStreamReady={camera.isStreamReady}
                errorMessage={camera.errorMessage}
              />

              <div className="photo-camera-overlay">
                <p className="text-center text-sm font-medium text-white drop-shadow">
                  Umístěte celý formulář do záběru
                </p>
              </div>
            </div>

            <div className="photo-camera-actions">
              <button
                type="button"
                className={`photo-capture-btn photo-capture-btn--primary ${!camera.canCapture ? 'photo-capture-btn--disabled' : ''}`}
                disabled={!camera.canCapture}
                onClick={() => void handleCameraCapture()}
              >
                <Camera className="h-6 w-6" />
                Vyfotit
              </button>

              {(camera.phase === 'denied' ||
                camera.phase === 'unavailable' ||
                (camera.phase === 'active' && !camera.isStreamReady)) && (
                <label className="photo-capture-btn photo-capture-btn--primary">
                  <Camera className="h-6 w-6" />
                  Systémový fotoaparát
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleNativeCameraInput}
                  />
                </label>
              )}

              <label className="photo-capture-btn photo-capture-btn--secondary">
                <ImagePlus className="h-5 w-5" />
                Galerie
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleGalleryInput}
                />
              </label>
            </div>

            {camera.errorMessage && (camera.phase === 'denied' || camera.phase === 'unavailable') && (
              <div className="mt-2 space-y-1 text-center text-xs">
                <p className="text-red-400">{camera.errorMessage}</p>
                <button type="button" className="text-sky-400 underline" onClick={camera.retry}>
                  Zkusit webovou kameru znovu
                </button>
              </div>
            )}

            {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
          </div>
        </div>
      </Card>
    </div>
  )
}

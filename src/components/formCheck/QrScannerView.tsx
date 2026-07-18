import { Camera, Loader2, ScanLine } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useCameraStream } from '@/hooks/useCameraStream'
import { useQrScanner } from '@/hooks/useQrScanner'
import type { FormCheckError } from '@/types/formCheck'

interface QrScannerViewProps {
  active: boolean
  resolving: boolean
  onScan: (payload: string) => void
  error: FormCheckError | null
  onDismissError?: () => void
}

export function QrScannerView({
  active,
  resolving,
  onScan,
  error,
  onDismissError,
}: QrScannerViewProps) {
  const camera = useCameraStream({ enabled: active && !resolving, facingMode: 'environment' })
  const scanner = useQrScanner({
    enabled: active && !resolving && camera.canCapture,
    videoRef: camera.videoRef,
    onScan,
  })

  const displayError =
    error?.message ?? camera.errorMessage ?? scanner.error ?? null

  return (
    <Card className="overflow-hidden" padding={false}>
      <div className="relative aspect-[3/4] w-full max-w-lg mx-auto bg-black/40 sm:aspect-[4/3]">
        <video
          ref={camera.setVideoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-48 w-48 rounded-2xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] sm:h-56 sm:w-56" />
        </div>

        {camera.needsUserStart && (
          <div className="photo-camera-start-overlay">
            <button
              type="button"
              className="photo-capture-btn photo-capture-btn--primary"
              onClick={camera.start}
            >
              <Camera className="h-6 w-6" />
              Spustit kameru
            </button>
          </div>
        )}

        {(camera.phase === 'starting' || resolving) && !camera.needsUserStart && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <p className="text-sm text-white/90">
              {resolving ? 'Ověřuji formulář…' : 'Spouštím kameru…'}
            </p>
          </div>
        )}

        {scanner.scanning && camera.canCapture && !resolving && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white">
              <ScanLine className="h-4 w-4" />
              Namiřte kameru na QR kód formuláře
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-6">
        <p className="text-sm text-theme-secondary">
          Po načtení QR kódu se ověří existence formuláře a zobrazí potvrzovací obrazovka.
        </p>

        {displayError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <p>{displayError}</p>
            {error && onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="mt-2 underline hover:text-red-200"
              >
                Zkusit znovu
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

import { Camera } from 'lucide-react'
import type { CameraPhase, CameraStartupDiagnostics } from '@/hooks/useCameraStream'
import { CameraDiagnosticsPanel } from '@/components/photos/CameraDiagnosticsPanel'
import { isCameraDebugEnabled } from '@/lib/photos/cameraDebug'

interface CameraVideoPreviewProps {
  setVideoRef: (el: HTMLVideoElement | null) => void
  phase: CameraPhase
  isStreamReady: boolean
  errorMessage: string | null
  needsUserStart: boolean
  onStart: () => void
  diagnostics?: CameraStartupDiagnostics
}

/** Always-mounted <video> so MediaStream can attach before preview is ready (Android PWA). */
export function CameraVideoPreview({
  setVideoRef,
  phase,
  isStreamReady,
  errorMessage,
  needsUserStart,
  onStart,
  diagnostics,
}: CameraVideoPreviewProps) {
  const showWaiting = !isStreamReady && !needsUserStart
  const showDiagnostics = isCameraDebugEnabled() && diagnostics

  return (
    <>
      <video ref={setVideoRef} className="photo-camera-video" playsInline muted autoPlay />

      {showDiagnostics && (
        <CameraDiagnosticsPanel
          diagnostics={diagnostics}
          phase={phase}
          errorMessage={errorMessage}
          overlay
        />
      )}

      {needsUserStart && (
        <div className="photo-camera-start-overlay">
          <button type="button" className="photo-capture-btn photo-capture-btn--primary" onClick={() => void onStart()}>
            <Camera className="h-6 w-6" />
            Spustit kameru
          </button>
          <p className="max-w-xs px-4 text-center text-xs text-white/80">
            Android vyžaduje klepnutí pro povolení kamery. Poté uvidíte živý náhled.
          </p>
        </div>
      )}

      {showWaiting && (
        <div className="photo-camera-placeholder">
          <Camera className="h-12 w-12 text-white/40" />
          <p className="mt-3 text-sm text-white/70">
            {phase === 'starting'
              ? 'Spouštím kameru…'
              : errorMessage || 'Čekám na náhled kamery…'}
          </p>
        </div>
      )}
    </>
  )
}

import { Camera } from 'lucide-react'
import type { CameraPhase } from '@/hooks/useCameraStream'

interface CameraVideoPreviewProps {
  setVideoRef: (el: HTMLVideoElement | null) => void
  phase: CameraPhase
  isStreamReady: boolean
  errorMessage: string | null
}

/** Vždy namountovaný <video> – MediaStream se připojí i když náhled ještě není vidět (oprava race condition). */
export function CameraVideoPreview({
  setVideoRef,
  phase,
  isStreamReady,
  errorMessage,
}: CameraVideoPreviewProps) {
  const showPlaceholder = !isStreamReady

  return (
    <>
      <video
        ref={setVideoRef}
        className={`photo-camera-video ${showPlaceholder ? 'photo-camera-video--hidden' : ''}`}
        playsInline
        muted
        autoPlay
      />
      {showPlaceholder && (
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

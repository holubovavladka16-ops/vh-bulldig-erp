import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collectCameraDiagnostics,
  logCameraDiagnostics,
  queryCameraPermissionState,
  type CameraDiagnostics,
} from '@/lib/camera/cameraDiagnostics'

export type CameraPhase = 'idle' | 'starting' | 'active' | 'denied' | 'unavailable'

export type CameraErrorCode =
  | 'not_supported'
  | 'permission_denied'
  | 'camera_unavailable'
  | 'stream_not_ready'
  | 'zero_dimensions'
  | 'canvas_error'
  | 'capture_failed'
  | 'other'

export interface CameraError {
  code: CameraErrorCode
  message: string
  domException?: string
}

export interface CaptureFrameResult {
  file: File | null
  error: CameraError | null
}

interface UseCameraStreamOptions {
  enabled: boolean
  facingMode?: 'environment' | 'user'
  /** Identifikátor modulu pro oddělený lifecycle a diagnostiku. */
  moduleId?: string
}

let nextInstanceId = 1

export function classifyGetUserMediaError(err: unknown): CameraError {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return {
        code: 'permission_denied',
        message:
          'Přístup ke kameře byl zamítnut. Povolte kameru v nastavení prohlížeče nebo PWA, případně použijte systémový fotoaparát.',
        domException: err.name,
      }
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return {
        code: 'camera_unavailable',
        message: 'Kamera nebyla nalezena na tomto zařízení. Použijte systémový fotoaparát nebo Galerii.',
        domException: err.name,
      }
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return {
        code: 'camera_unavailable',
        message:
          'Kamera je obsazená jinou aplikací nebo se nepodařila spustit. Zavřete ostatní aplikace používající kameru.',
        domException: err.name,
      }
    }
    if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
      return {
        code: 'camera_unavailable',
        message: 'Požadovaná kamera není dostupná. Zkuste systémový fotoaparát.',
        domException: err.name,
      }
    }
    if (err.name === 'SecurityError') {
      return {
        code: 'permission_denied',
        message: 'Přístup ke kameře je blokován (vyžadováno HTTPS nebo oprávnění PWA).',
        domException: err.name,
      }
    }
    return {
      code: 'other',
      message: `Chyba kamery: ${err.message || err.name}`,
      domException: err.name,
    }
  }
  return {
    code: 'other',
    message: err instanceof Error ? err.message : 'Neznámá chyba kamery.',
  }
}

function isVideoStreamReady(video: HTMLVideoElement): boolean {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0 &&
    !video.paused
  )
}

export function useCameraStream({
  enabled,
  facingMode = 'environment',
  moduleId = 'camera',
}: UseCameraStreamOptions) {
  const instanceIdRef = useRef(nextInstanceId++)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastGumErrorRef = useRef<{ name: string; message: string } | null>(null)
  const [phase, setPhase] = useState<CameraPhase>('idle')
  const [isStreamReady, setIsStreamReady] = useState(false)
  const [error, setError] = useState<CameraError | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [permissionState, setPermissionState] = useState<
    PermissionState | 'unknown' | 'unsupported'
  >('unknown')

  const scopedModuleId = `${moduleId}#${instanceIdRef.current}`

  const buildDiagnostics = useCallback((): CameraDiagnostics => {
    return collectCameraDiagnostics({
      moduleId: scopedModuleId,
      phase,
      video: videoRef.current,
      stream: streamRef.current,
      isStreamReady,
      getUserMediaError: lastGumErrorRef.current,
    })
  }, [scopedModuleId, phase, isStreamReady])

  const updateStreamReady = useCallback(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) {
      setIsStreamReady(false)
      return
    }
    const trackActive = stream.getVideoTracks().some((t) => t.readyState === 'live')
    const ready = trackActive && isVideoStreamReady(video)
    setIsStreamReady(ready)
    if (ready) {
      logCameraDiagnostics(buildDiagnostics(), 'stream ready')
    }
  }, [buildDiagnostics])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreamReady(false)
    setPhase('idle')
    logCameraDiagnostics(
      collectCameraDiagnostics({
        moduleId: scopedModuleId,
        phase: 'idle',
        video: videoRef.current,
        stream: null,
        isStreamReady: false,
        getUserMediaError: lastGumErrorRef.current,
      }),
      'stopped'
    )
  }, [scopedModuleId])

  const attachStreamToVideo = useCallback(async () => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return

    if (video.srcObject !== stream) {
      video.srcObject = stream
    }

    try {
      await video.play()
    } catch (err) {
      const domErr = err instanceof DOMException ? err : undefined
      if (domErr?.name === 'AbortError') return
      setError({
        code: 'stream_not_ready',
        message:
          'Video náhled se nepodařilo přehrát. Zkuste znovu nebo použijte systémový fotoaparát.',
        domException: domErr?.name,
      })
    }

    updateStreamReady()
  }, [updateStreamReady])

  useEffect(() => {
    void queryCameraPermissionState().then(setPermissionState)
  }, [enabled, retryCount])

  useEffect(() => {
    if (!enabled) {
      stop()
      setError(null)
      lastGumErrorRef.current = null
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unavailable')
      setError({
        code: 'not_supported',
        message:
          'Prohlížeč nepodporuje webovou kameru (getUserMedia). Použijte systémový fotoaparát nebo Galerii.',
      })
      return
    }

    let cancelled = false
    setPhase('starting')
    setError(null)
    setIsStreamReady(false)
    lastGumErrorRef.current = null

    logCameraDiagnostics(
      collectCameraDiagnostics({
        moduleId: scopedModuleId,
        phase: 'starting',
        video: videoRef.current,
        stream: null,
        isStreamReady: false,
        getUserMediaError: null,
      }),
      'requesting getUserMedia'
    )

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        setPhase('active')
        void attachStreamToVideo()
        logCameraDiagnostics(
          collectCameraDiagnostics({
            moduleId: scopedModuleId,
            phase: 'active',
            video: videoRef.current,
            stream,
            isStreamReady: false,
            getUserMediaError: null,
          }),
          'getUserMedia success'
        )
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const classified = classifyGetUserMediaError(err)
        lastGumErrorRef.current = {
          name: err instanceof DOMException ? err.name : 'Error',
          message: classified.message,
        }
        setError(classified)
        setPhase(classified.code === 'permission_denied' ? 'denied' : 'unavailable')
        logCameraDiagnostics(
          collectCameraDiagnostics({
            moduleId: scopedModuleId,
            phase: classified.code === 'permission_denied' ? 'denied' : 'unavailable',
            video: videoRef.current,
            stream: null,
            isStreamReady: false,
            getUserMediaError: lastGumErrorRef.current,
          }),
          'getUserMedia failed'
        )
      })

    return () => {
      cancelled = true
      stop()
    }
  }, [enabled, facingMode, stop, attachStreamToVideo, retryCount, scopedModuleId])

  useEffect(() => {
    if (!enabled || phase !== 'active' || !streamRef.current) return

    void attachStreamToVideo()

    const video = videoRef.current
    if (!video) return

    const onReady = () => updateStreamReady()
    video.addEventListener('loadedmetadata', onReady)
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('playing', onReady)
    video.addEventListener('resize', onReady)

    const interval = window.setInterval(updateStreamReady, 250)
    const timeout = window.setTimeout(updateStreamReady, 3000)

    return () => {
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('playing', onReady)
      video.removeEventListener('resize', onReady)
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [enabled, phase, attachStreamToVideo, updateStreamReady])

  useEffect(() => {
    if (!enabled) return

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      const video = videoRef.current
      const stream = streamRef.current
      if (!video || !stream) return
      if (video.paused && stream.getVideoTracks().some((t) => t.readyState === 'live')) {
        void video.play().then(updateStreamReady).catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, updateStreamReady])

  const captureFrame = useCallback(async (): Promise<CaptureFrameResult> => {
    const video = videoRef.current
    const stream = streamRef.current

    if (!stream || !stream.getVideoTracks().some((t) => t.readyState === 'live')) {
      return {
        file: null,
        error: {
          code: 'stream_not_ready',
          message: 'Kamerový stream neběží. Počkejte na náhled nebo použijte systémový fotoaparát.',
        },
      }
    }

    if (!video) {
      return {
        file: null,
        error: {
          code: 'stream_not_ready',
          message: 'Video prvek není připraven. Zkuste znovu za chvíli.',
        },
      }
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return {
        file: null,
        error: {
          code: 'stream_not_ready',
          message: `Video stream není připraven (readyState=${video.readyState}). Počkejte na náhled.`,
        },
      }
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return {
        file: null,
        error: {
          code: 'zero_dimensions',
          message: `Video má nulové rozměry (${video.videoWidth}×${video.videoHeight}). Počkejte na náhled nebo použijte systémový fotoaparát.`,
        },
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return {
        file: null,
        error: {
          code: 'canvas_error',
          message: 'Canvas kontext není dostupný. Zkuste systémový fotoaparát.',
        },
      }
    }

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    } catch (err) {
      return {
        file: null,
        error: {
          code: 'canvas_error',
          message: `Chyba při vykreslení snímku: ${err instanceof Error ? err.message : 'neznámá chyba'}.`,
        },
      }
    }

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              file: null,
              error: {
                code: 'capture_failed',
                message: 'Snímek se nepodařilo zakódovat do JPEG. Zkuste znovu.',
              },
            })
            return
          }
          resolve({
            file: new File([blob], `gps_photo_${Date.now()}.jpg`, { type: 'image/jpeg' }),
            error: null,
          })
        },
        'image/jpeg',
        0.92
      )
    })
  }, [])

  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el
      if (el && streamRef.current && phase === 'active') {
        void attachStreamToVideo()
      }
    },
    [attachStreamToVideo, phase]
  )

  const retry = useCallback(() => {
    if (!enabled) return
    stop()
    setError(null)
    lastGumErrorRef.current = null
    setRetryCount((n) => n + 1)
  }, [enabled, stop])

  const getDiagnostics = useCallback(async (): Promise<CameraDiagnostics> => {
    const diagnostics = buildDiagnostics()
    diagnostics.permissionState = await queryCameraPermissionState()
    return diagnostics
  }, [buildDiagnostics])

  return {
    videoRef,
    setVideoRef,
    moduleId: scopedModuleId,
    phase,
    error,
    errorMessage: error?.message ?? null,
    permissionState,
    isActive: phase === 'active',
    isStreamReady,
    canCapture: phase === 'active' && isStreamReady,
    captureFrame,
    stop,
    retry,
    getDiagnostics,
  }
}

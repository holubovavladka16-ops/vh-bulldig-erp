import { useCallback, useEffect, useRef, useState } from 'react'

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

export type CameraStartResult = { ok: true } | { ok: false; message: string }

export type GetUserMediaStatus = 'idle' | 'pending' | 'ok' | 'error'

export interface CameraStartupDiagnostics {
  step: string
  getUserMediaStatus: GetUserMediaStatus
  getUserMediaError: string | null
  constraintsUsed: string | null
  permissionState: string | null
  streamActive: boolean
  streamId: string | null
  trackSummary: string
  videoMounted: boolean
  srcObjectAssigned: boolean
  srcObjectMatches: boolean
  playAttempted: boolean
  playOk: boolean
  playError: string | null
  readyState: number
  readyStateLabel: string
  videoWidth: number
  videoHeight: number
  paused: boolean
  isStreamReady: boolean
  updatedAt: number
}

interface UseCameraStreamOptions {
  enabled: boolean
  facingMode?: 'environment' | 'user'
}

const READY_STATE_LABELS = [
  'HAVE_NOTHING (0)',
  'HAVE_METADATA (1)',
  'HAVE_CURRENT_DATA (2)',
  'HAVE_FUTURE_DATA (3)',
  'HAVE_ENOUGH_DATA (4)',
] as const

const INITIAL_DIAGNOSTICS: CameraStartupDiagnostics = {
  step: 'idle',
  getUserMediaStatus: 'idle',
  getUserMediaError: null,
  constraintsUsed: null,
  permissionState: null,
  streamActive: false,
  streamId: null,
  trackSummary: '—',
  videoMounted: false,
  srcObjectAssigned: false,
  srcObjectMatches: false,
  playAttempted: false,
  playOk: false,
  playError: null,
  readyState: 0,
  readyStateLabel: READY_STATE_LABELS[0],
  videoWidth: 0,
  videoHeight: 0,
  paused: true,
  isStreamReady: false,
  updatedAt: Date.now(),
}

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export function classifyGetUserMediaError(err: unknown): CameraError {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return {
        code: 'permission_denied',
        message:
          'Přístup ke kameře byl zamítnut. Povolte kameru v nastavení prohlížeče nebo PWA.',
        domException: err.name,
      }
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return {
        code: 'camera_unavailable',
        message: 'Kamera nebyla nalezena na tomto zařízení.',
        domException: err.name,
      }
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return {
        code: 'camera_unavailable',
        message:
          'Kamera je obsazená jinou aplikací nebo se nepodařila spustit.',
        domException: err.name,
      }
    }
    if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
      return {
        code: 'camera_unavailable',
        message: 'Požadovaná kamera není dostupná s danými parametry.',
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

function isVideoStreamReady(video: HTMLVideoElement, stream: MediaStream): boolean {
  const trackActive = stream.getVideoTracks().some((t) => t.readyState === 'live')
  return (
    trackActive &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  )
}

function summarizeTracks(stream: MediaStream | null): string {
  if (!stream) return '—'
  return (
    stream
      .getVideoTracks()
      .map((t) => `${t.label || 'video'}:${t.readyState}`)
      .join(', ') || 'žádná video stopa'
  )
}

function readyStateLabel(state: number): string {
  return READY_STATE_LABELS[state] ?? `unknown (${state})`
}

async function queryCameraPermission(): Promise<string | null> {
  try {
    if (!navigator.permissions?.query) return null
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return result.state
  } catch {
    return null
  }
}

async function requestCameraStream(
  facingMode: 'environment' | 'user',
  onAttempt: (constraints: MediaStreamConstraints) => void
): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    },
    { video: { facingMode: { ideal: facingMode } }, audio: false },
    { video: { facingMode }, audio: false },
    { video: true, audio: false },
  ]

  let lastError: unknown
  for (const constraints of attempts) {
    onAttempt(constraints)
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastError = err
      if (
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' ||
          err.name === 'PermissionDeniedError' ||
          err.name === 'SecurityError')
      ) {
        throw err
      }
    }
  }
  throw lastError
}

function prepareVideoElement(video: HTMLVideoElement): void {
  video.muted = true
  video.playsInline = true
  video.autoplay = true
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.setAttribute('muted', 'true')
  video.setAttribute('autoplay', 'true')
}

export function useCameraStream({ enabled, facingMode = 'environment' }: UseCameraStreamOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const enabledRef = useRef(enabled)
  const startingRef = useRef(false)
  const autoStartedRef = useRef(false)
  const streamLatchReadyRef = useRef(false)
  const [phase, setPhase] = useState<CameraPhase>('idle')
  const [isStreamReady, setIsStreamReady] = useState(false)
  const [error, setError] = useState<CameraError | null>(null)
  const [diagnostics, setDiagnostics] = useState<CameraStartupDiagnostics>(INITIAL_DIAGNOSTICS)

  enabledRef.current = enabled

  const needsUserStart =
    enabled &&
    isTouchDevice() &&
    (phase === 'idle' || phase === 'denied' || phase === 'unavailable')

  const patchDiagnostics = useCallback((patch: Partial<CameraStartupDiagnostics>) => {
    setDiagnostics((prev) => ({
      ...prev,
      ...patch,
      updatedAt: Date.now(),
    }))
  }, [])

  const collectVideoDiagnostics = useCallback(
    (step: string, extra?: Partial<CameraStartupDiagnostics>) => {
      const video = videoRef.current
      const stream = streamRef.current
      const streamReady = video && stream ? isVideoStreamReady(video, stream) : false

      setIsStreamReady(streamReady)
      if (streamReady) {
        streamLatchReadyRef.current = true
      }
      patchDiagnostics({
        step,
        streamActive: Boolean(stream?.active),
        streamId: stream?.id ?? null,
        trackSummary: summarizeTracks(stream),
        videoMounted: Boolean(video),
        srcObjectAssigned: Boolean(video?.srcObject),
        srcObjectMatches: Boolean(video && stream && video.srcObject === stream),
        readyState: video?.readyState ?? 0,
        readyStateLabel: readyStateLabel(video?.readyState ?? 0),
        videoWidth: video?.videoWidth ?? 0,
        videoHeight: video?.videoHeight ?? 0,
        paused: video?.paused ?? true,
        isStreamReady: streamReady,
        ...extra,
      })
      return streamReady
    },
    [patchDiagnostics]
  )

  const stop = useCallback(() => {
    startingRef.current = false
    streamLatchReadyRef.current = false
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreamReady(false)
    setPhase('idle')
    patchDiagnostics({
      ...INITIAL_DIAGNOSTICS,
      step: 'stopped',
    })
  }, [patchDiagnostics])

  const attachStreamToVideo = useCallback(async () => {
    const video = videoRef.current
    const stream = streamRef.current

    if (!video || !stream) {
      collectVideoDiagnostics('attach_skipped_no_video_or_stream', {
        videoMounted: Boolean(video),
        streamActive: Boolean(stream?.active),
      })
      return
    }

    prepareVideoElement(video)
    collectVideoDiagnostics('assigning_srcobject')

    if (video.srcObject !== stream) {
      video.srcObject = stream
    }

    collectVideoDiagnostics('srcobject_assigned', {
      srcObjectAssigned: Boolean(video.srcObject),
      srcObjectMatches: video.srcObject === stream,
      playAttempted: false,
      playOk: false,
      playError: null,
    })

    collectVideoDiagnostics('calling_play', { playAttempted: true })

    try {
      await video.play()
      collectVideoDiagnostics('play_ok', {
        playOk: true,
        playError: null,
        paused: video.paused,
      })
    } catch (err) {
      const domErr = err instanceof DOMException ? err : undefined
      if (domErr?.name === 'AbortError') {
        collectVideoDiagnostics('play_aborted', {
          playOk: false,
          playError: domErr.name,
          paused: video.paused,
        })
        return
      }
      const playError = domErr
        ? `${domErr.name}: ${domErr.message}`
        : err instanceof Error
          ? err.message
          : String(err)
      setError({
        code: 'stream_not_ready',
        message: `video.play() selhalo: ${playError}`,
        domException: domErr?.name,
      })
      collectVideoDiagnostics('play_failed', {
        playOk: false,
        playError,
        paused: video.paused,
      })
    }

    requestAnimationFrame(() => {
      collectVideoDiagnostics('post_play_frame')
    })
  }, [collectVideoDiagnostics])

  /** Volat přímo z onClick — getUserMedia musí běžet v user-gesture řetězci (Android). */
  const start = useCallback(async (): Promise<CameraStartResult> => {
    if (!enabledRef.current || startingRef.current) {
      return streamRef.current?.active ? { ok: true } : { ok: false, message: 'Kamera se spouští…' }
    }
    if (streamRef.current?.active) {
      await attachStreamToVideo()
      return { ok: true }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'Prohlížeč nepodporuje getUserMedia.'
      setPhase('unavailable')
      setError({
        code: 'not_supported',
        message,
      })
      patchDiagnostics({
        step: 'not_supported',
        getUserMediaStatus: 'error',
        getUserMediaError: 'navigator.mediaDevices.getUserMedia missing',
      })
      return { ok: false, message }
    }

    startingRef.current = true
    setPhase('starting')
    setError(null)
    setIsStreamReady(false)
    patchDiagnostics({
      step: 'requesting_getusermedia',
      getUserMediaStatus: 'pending',
      getUserMediaError: null,
      constraintsUsed: null,
      isStreamReady: false,
    })

    void queryCameraPermission().then((permissionState) => {
      patchDiagnostics({ permissionState })
    })

    try {
      const stream = await requestCameraStream(facingMode, (constraints) => {
        patchDiagnostics({
          step: 'getusermedia_attempt',
          constraintsUsed: JSON.stringify(constraints),
        })
      })

      if (!enabledRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return { ok: false, message: 'Kamera byla zrušena.' }
      }

      streamRef.current = stream
      setPhase('active')
      patchDiagnostics({
        step: 'getusermedia_ok',
        getUserMediaStatus: 'ok',
        getUserMediaError: null,
        streamActive: stream.active,
        streamId: stream.id,
        trackSummary: summarizeTracks(stream),
      })

      await attachStreamToVideo()
      return { ok: true }
    } catch (err: unknown) {
      if (!enabledRef.current) return { ok: false, message: 'Kamera byla zrušena.' }
      const classified = classifyGetUserMediaError(err)
      const errText =
        err instanceof DOMException
          ? `${err.name}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err)
      setError(classified)
      setPhase(classified.code === 'permission_denied' ? 'denied' : 'unavailable')
      patchDiagnostics({
        step: 'getusermedia_error',
        getUserMediaStatus: 'error',
        getUserMediaError: errText,
        isStreamReady: false,
      })
      return { ok: false, message: classified.message }
    } finally {
      startingRef.current = false
    }
  }, [attachStreamToVideo, facingMode, patchDiagnostics])

  useEffect(() => {
    if (!enabled) {
      autoStartedRef.current = false
      stop()
      setError(null)
      patchDiagnostics({
        step: 'waiting_for_user_start',
        getUserMediaStatus: 'idle',
      })
      return
    }

    if (!isTouchDevice() && !autoStartedRef.current) {
      autoStartedRef.current = true
      void start()
    }
  }, [enabled, start, stop, patchDiagnostics])

  useEffect(() => {
    if (!enabled || phase !== 'active' || !streamRef.current) return

    void attachStreamToVideo()

    const video = videoRef.current
    if (!video) {
      patchDiagnostics({ step: 'waiting_for_video_element', videoMounted: false })
      return
    }

    const onReady = () => {
      collectVideoDiagnostics('video_event_ready')
    }

    video.addEventListener('loadedmetadata', onReady)
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('playing', onReady)
    video.addEventListener('canplay', onReady)
    video.addEventListener('resize', onReady)

    const interval = window.setInterval(() => {
      collectVideoDiagnostics('polling_ready_state')
    }, 250)
    const timeout = window.setTimeout(() => {
      collectVideoDiagnostics('ready_state_timeout')
    }, 5000)

    return () => {
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('playing', onReady)
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('resize', onReady)
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [enabled, phase, attachStreamToVideo, collectVideoDiagnostics, patchDiagnostics])

  useEffect(() => {
    if (!enabled) return

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      const video = videoRef.current
      const stream = streamRef.current
      if (!video || !stream) return
      if (video.paused && stream.getVideoTracks().some((t) => t.readyState === 'live')) {
        void video
          .play()
          .then(() => collectVideoDiagnostics('play_resumed_on_visible'))
          .catch((err) => {
            const playError =
              err instanceof DOMException
                ? `${err.name}: ${err.message}`
                : err instanceof Error
                  ? err.message
                  : String(err)
            collectVideoDiagnostics('play_resume_failed', { playError, playOk: false })
          })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, collectVideoDiagnostics])

  const waitForStreamReady = useCallback((timeoutMs = 10000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs

      const tick = () => {
        const video = videoRef.current
        const stream = streamRef.current
        if (video && stream && isVideoStreamReady(video, stream)) {
          streamLatchReadyRef.current = true
          setIsStreamReady(true)
          resolve()
          return
        }

        if (Date.now() >= deadline) {
          reject(
            new Error(
              'Kamerový náhled není připraven. Počkejte na živý obraz nebo klepněte na „Spustit kameru“.'
            )
          )
          return
        }

        window.setTimeout(tick, 50)
      }

      tick()
    })
  }, [])

  const captureFrame = useCallback(async (): Promise<CaptureFrameResult> => {
    const video = videoRef.current
    const stream = streamRef.current

    if (!stream || !stream.getVideoTracks().some((t) => t.readyState === 'live')) {
      return {
        file: null,
        error: {
          code: 'stream_not_ready',
          message: 'Kamerový stream neběží.',
        },
      }
    }

    if (!video) {
      return {
        file: null,
        error: {
          code: 'stream_not_ready',
          message: 'Video prvek není připraven.',
        },
      }
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return {
        file: null,
        error: {
          code: 'stream_not_ready',
          message: `Video stream není připraven (readyState=${video.readyState}).`,
        },
      }
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return {
        file: null,
        error: {
          code: 'zero_dimensions',
          message: `Video má nulové rozměry (${video.videoWidth}×${video.videoHeight}).`,
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
          message: 'Canvas kontext není dostupný.',
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
                message: 'Snímek se nepodařilo zakódovat do JPEG.',
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
      patchDiagnostics({ videoMounted: Boolean(el) })

      if (el) {
        prepareVideoElement(el)
      }

      if (el && streamRef.current) {
        void attachStreamToVideo()
      }
    },
    [attachStreamToVideo, patchDiagnostics]
  )

  const retry = useCallback(() => {
    if (!enabledRef.current) return
    stop()
    setError(null)
    void start()
  }, [start, stop])

  return {
    videoRef,
    setVideoRef,
    phase,
    error,
    errorMessage: error?.message ?? null,
    diagnostics,
    isActive: phase === 'active',
    isStreamReady,
    canCapture:
      phase === 'active' && (isStreamReady || streamLatchReadyRef.current),
    needsUserStart,
    start,
    waitForStreamReady,
    captureFrame,
    stop,
    retry,
  }
}

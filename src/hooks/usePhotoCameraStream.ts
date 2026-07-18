import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraPhase = 'idle' | 'starting' | 'active' | 'denied' | 'unavailable'

interface UseCameraStreamOptions {
  enabled: boolean
  facingMode?: 'environment' | 'user'
}

export function usePhotoCameraStream({ enabled, facingMode = 'environment' }: UseCameraStreamOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<CameraPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setPhase('idle')
  }, [])

  useEffect(() => {
    if (!enabled) {
      stop()
      setError(null)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unavailable')
      setError('Prohlížeč nepodporuje přímý přístup ke kameře. Použijte tlačítko Galerie.')
      return
    }

    let cancelled = false
    setPhase('starting')
    setError(null)

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
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          void video.play().catch(() => {})
        }
        setPhase('active')
      })
      .catch((err: DOMException) => {
        if (cancelled) return
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPhase('denied')
          setError('Přístup ke kameře byl zamítnut. Povolte kameru nebo použijte Galerie.')
        } else {
          setPhase('unavailable')
          setError('Kameru se nepodařilo spustit. Použijte tlačítko Galerie.')
        }
      })

    return () => {
      cancelled = true
      stop()
    }
  }, [enabled, facingMode, stop])

  const captureFrame = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null)
            return
          }
          resolve(new File([blob], `gps_photo_${Date.now()}.jpg`, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.92
      )
    })
  }, [])

  return {
    videoRef,
    phase,
    error,
    isActive: phase === 'active',
    captureFrame,
    stop,
  }
}

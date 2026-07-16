import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraPhase = 'idle' | 'starting' | 'active' | 'denied' | 'unavailable' | 'insecure' | 'in_use'

interface UseCameraStreamOptions {
  facingMode?: 'environment' | 'user'
}

/**
 * Kamera se spouští VÝHRADNĚ voláním start() přímo z click handleru (uživatelského gesta).
 * Automatické spuštění getUserMedia mimo přímou reakci na klik je nespolehlivé na řadě mobilních
 * prohlížečů (zejména Safari na iPhonu) – prohlížeč může požadavek na oprávnění tiše zablokovat
 * nebo nechat viset bez odpovědi. Proto zde není žádný automatický "spusť při mountu" efekt.
 */
export function useCameraStream({ facingMode = 'environment' }: UseCameraStreamOptions = {}) {
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

  // Bezpečnostní pojistka: pokud komponenta zmizí (zavření modalu, přepnutí záložky), kamera se
  // vždy vypne, aby stream nezůstal aktivní na pozadí.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)

    if (!window.isSecureContext) {
      setPhase('insecure')
      setError('Aplikace musí být otevřena přes zabezpečené připojení HTTPS.')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unavailable')
      setError('Fotoaparát není na tomto zařízení dostupný. Použijte tlačítko Galerie.')
      return
    }

    setPhase('starting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
      setPhase('active')
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        setPhase('denied')
        setError('Přístup k fotoaparátu byl zamítnut. Povolte kameru v nastavení prohlížeče nebo použijte Galerie.')
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setPhase('unavailable')
        setError('Fotoaparát není na tomto zařízení dostupný. Použijte tlačítko Galerie.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setPhase('in_use')
        setError('Fotoaparát právě používá jiná aplikace. Zavřete ji a zkuste to znovu.')
      } else {
        setPhase('unavailable')
        setError('Fotoaparát se nepodařilo spustit. Zkuste to znovu nebo použijte Galerie.')
      }
    }
  }, [facingMode])

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
    isStarting: phase === 'starting',
    start,
    captureFrame,
    stop,
  }
}

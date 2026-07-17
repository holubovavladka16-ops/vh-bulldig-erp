import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'

interface UseQrScannerOptions {
  enabled: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  onScan: (payload: string) => void
}

export function useQrScanner({ enabled, videoRef, onScan }: UseQrScannerOptions) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const lastScanRef = useRef<string | null>(null)
  const onScanRef = useRef(onScan)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => {
    if (!enabled) {
      stopScanner()
      setError(null)
      lastScanRef.current = null
      return
    }

    const video = videoRef.current
    if (!video) return

    let cancelled = false
    const reader = new BrowserQRCodeReader()

    setScanning(true)
    setError(null)

    reader
      .decodeFromVideoDevice(undefined, video, (result, err) => {
        if (cancelled) return

        if (result) {
          const text = result.getText().trim()
          if (!text || text === lastScanRef.current) return
          lastScanRef.current = text
          stopScanner()
          onScanRef.current(text)
          return
        }

        if (err && !(err instanceof NotFoundException)) {
          setError('Skenování QR kódu selhalo. Zkuste kameru přiblížit k formuláři.')
        }
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('Přístup ke kameře byl zamítnut. Povolte kameru v nastavení prohlížeče.')
        } else {
          setError('Kameru se nepodařilo spustit pro skenování QR kódu.')
        }
        setScanning(false)
      })

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [enabled, videoRef, stopScanner])

  return {
    scanning,
    error,
    stopScanner,
  }
}

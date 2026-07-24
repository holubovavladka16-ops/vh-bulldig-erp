import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type GpsPositionState,
  startGpsLocateSession,
} from '@/lib/photos/gpsWatch'
import { reverseGeocode } from '@/lib/photos/geocoding'
import type { GeocodedAddress } from '@/types/photos'

export type ExcavationGpsPhase = 'idle' | 'locating' | 'active' | 'error'

export interface UseExcavationGpsLocateOptions {
  /** Volá se při každé aktualizaci polohy (mapa, formulář). */
  onPositionUpdate?: (position: GpsPositionState) => void
}

export function useExcavationGpsLocate(
  enabled: boolean,
  options: UseExcavationGpsLocateOptions = {}
) {
  const { onPositionUpdate } = options
  const onPositionUpdateRef = useRef(onPositionUpdate)
  onPositionUpdateRef.current = onPositionUpdate

  const [phase, setPhase] = useState<ExcavationGpsPhase>('idle')
  const [position, setPosition] = useState<GpsPositionState | null>(null)
  const [address, setAddress] = useState<GeocodedAddress | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionKey, setSessionKey] = useState(0)

  const geocodeGenerationRef = useRef(0)

  const scheduleGeocode = useCallback((pos: GpsPositionState) => {
    const generation = ++geocodeGenerationRef.current
    setAddressLoading(true)
    void reverseGeocode(pos.lat, pos.lng)
      .then((result) => {
        if (generation !== geocodeGenerationRef.current) return
        setAddress(result)
      })
      .catch(() => {
        if (generation !== geocodeGenerationRef.current) return
        setAddress(null)
      })
      .finally(() => {
        if (generation !== geocodeGenerationRef.current) return
        setAddressLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!enabled) {
      setPhase('idle')
      setPosition(null)
      setAddress(null)
      setAddressLoading(false)
      setError(null)
      geocodeGenerationRef.current += 1
      return
    }

    setPhase('locating')
    setPosition(null)
    setAddress(null)
    setError(null)

    const session = startGpsLocateSession({
      onUpdate: (state) => {
        setPosition(state)
        setPhase('active')
        setError(null)
        scheduleGeocode(state)
        onPositionUpdateRef.current?.(state)
      },
      onError: (message) => {
        setError(message)
        setPhase('error')
      },
    })

    return () => {
      session.stop()
      geocodeGenerationRef.current += 1
    }
  }, [enabled, sessionKey, scheduleGeocode])

  const retry = useCallback(() => {
    setSessionKey((key) => key + 1)
  }, [])

  const stop = useCallback(() => {
    setPhase('idle')
    setPosition(null)
    setAddress(null)
    setError(null)
    geocodeGenerationRef.current += 1
  }, [])

  const hasFix = position != null && phase === 'active'

  return {
    phase,
    position,
    address,
    addressLoading,
    error,
    hasFix,
    retry,
    stop,
  }
}

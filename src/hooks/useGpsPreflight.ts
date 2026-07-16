import { useCallback, useEffect, useRef, useState } from 'react'
import { GPS_TARGET_ACCURACY_METERS, reverseGeocode } from '@/lib/photos/geocoding'
import { geocodeFallbackAddress } from '@/lib/photos/photoDisplay'
import {
  type GpsPositionState,
  startGpsWatch,
} from '@/lib/photos/gpsWatch'
import type { GeocodedAddress } from '@/types/photos'

export type GpsPreflightPhase =
  | 'initializing'
  | 'waiting'
  | 'ready'
  | 'timeout_prompt'
  | 'relaxed'

const GEOCODE_DEBOUNCE_MS = 1500
const GEOCODE_MIN_MOVE_M = 8

function distanceMeters(a: GpsPositionState, b: GpsPositionState): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function useGpsPreflight(enabled: boolean) {
  const [phase, setPhase] = useState<GpsPreflightPhase>('initializing')
  const [position, setPosition] = useState<GpsPositionState | null>(null)
  const [address, setAddress] = useState<GeocodedAddress | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetTimeoutRef = useRef<(() => void) | null>(null)
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastGeocodedRef = useRef<GpsPositionState | null>(null)
  const geocodeGenerationRef = useRef(0)

  const geocodeForPosition = useCallback(async (pos: GpsPositionState) => {
    const generation = ++geocodeGenerationRef.current
    setAddressLoading(true)
    try {
      const result = await reverseGeocode(pos.lat, pos.lng)
      if (generation !== geocodeGenerationRef.current) return
      setAddress(result)
      lastGeocodedRef.current = pos
    } catch {
      if (generation !== geocodeGenerationRef.current) return
      setAddress(geocodeFallbackAddress(pos.lat, pos.lng))
      lastGeocodedRef.current = pos
    } finally {
      if (generation === geocodeGenerationRef.current) {
        setAddressLoading(false)
      }
    }
  }, [])

  const scheduleGeocode = useCallback(
    (pos: GpsPositionState) => {
      const last = lastGeocodedRef.current
      if (last && distanceMeters(last, pos) < GEOCODE_MIN_MOVE_M) return

      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
      geocodeTimerRef.current = setTimeout(() => {
        void geocodeForPosition(pos)
      }, GEOCODE_DEBOUNCE_MS)
    },
    [geocodeForPosition]
  )

  useEffect(() => {
    if (!enabled) {
      setPhase('initializing')
      setPosition(null)
      setAddress(null)
      setAddressLoading(false)
      setError(null)
      return
    }

    setPhase('initializing')
    setPosition(null)
    setAddress(null)
    setAddressLoading(false)
    setError(null)
    lastGeocodedRef.current = null
    geocodeGenerationRef.current += 1

    const session = startGpsWatch({
      onUpdate: (state) => {
        setPosition(state)
        setError(null)
        scheduleGeocode(state)

        if (state.accuracy <= GPS_TARGET_ACCURACY_METERS) {
          setPhase('ready')
        } else {
          setPhase((current) =>
            current === 'relaxed' || current === 'timeout_prompt' ? current : 'waiting'
          )
        }
      },
      onTargetReached: () => {
        setPhase('ready')
      },
      onTimeout: (state) => {
        setPosition(state)
        scheduleGeocode(state)
        setPhase('timeout_prompt')
      },
      onError: (message) => {
        setError(message)
        setPhase('initializing')
      },
    })

    resetTimeoutRef.current = session.resetTimeout

    return () => {
      session.stop()
      resetTimeoutRef.current = null
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    }
  }, [enabled, scheduleGeocode])

  const acceptRelaxedAccuracy = useCallback(() => {
    setPhase('relaxed')
    setError(null)
  }, [])

  const continueSearching = useCallback(() => {
    setPhase('waiting')
    setError(null)
    resetTimeoutRef.current?.()
  }, [])

  const hasLocation = position != null
  const hasAddress = address != null && !addressLoading
  const accuracyReady = position != null && position.accuracy <= GPS_TARGET_ACCURACY_METERS
  const canCapture =
    hasLocation &&
    hasAddress &&
    (phase === 'ready' || phase === 'relaxed')

  return {
    phase,
    position,
    address,
    addressLoading,
    error,
    canCapture,
    accuracyReady,
    acceptRelaxedAccuracy,
    continueSearching,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { GPS_TARGET_ACCURACY_METERS, reverseGeocode } from '@/lib/photos/geocoding'
import { geocodeFallbackAddress } from '@/lib/photos/photoDisplay'
import {
  type GpsPositionState,
  type GpsTimingMetrics,
  GPS_PHOTO_MAX_WAIT_MS,
  startGpsWatch,
} from '@/lib/photos/gpsWatch'
import type { GeocodedAddress } from '@/types/photos'

export type GpsPreflightPhase =
  | 'initializing'
  | 'waiting'
  | 'ready'
  | 'timeout_prompt'
  | 'relaxed'

const GEOCODE_DEBOUNCE_MS = 800
const GEOCODE_MIN_MOVE_M = 8

export interface UseGpsPreflightOptions {
  /** Timeout čekání na nejlepší polohu (ms). Výchozí 5 s pro fotodokumentaci. */
  maxWaitMs?: number
  /** Po timeoutu automaticky přijmout nejlepší dostupnou polohu (bez ručního potvrzení). */
  autoAcceptOnTimeout?: boolean
}

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

const EMPTY_TIMING: GpsTimingMetrics = {
  firstFixMs: null,
  targetReachedMs: null,
  settledMs: null,
  settledAccuracy: null,
}

export function useGpsPreflight(enabled: boolean, options: UseGpsPreflightOptions = {}) {
  const {
    maxWaitMs = GPS_PHOTO_MAX_WAIT_MS,
    autoAcceptOnTimeout = true,
  } = options

  const [phase, setPhase] = useState<GpsPreflightPhase>('initializing')
  const [position, setPosition] = useState<GpsPositionState | null>(null)
  const [bestPosition, setBestPosition] = useState<GpsPositionState | null>(null)
  const [address, setAddress] = useState<GeocodedAddress | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timing, setTiming] = useState<GpsTimingMetrics>(EMPTY_TIMING)

  const resetTimeoutRef = useRef<(() => void) | null>(null)
  const getBestPositionRef = useRef<(() => GpsPositionState | null) | null>(null)
  const getTimingRef = useRef<(() => GpsTimingMetrics) | null>(null)
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastGeocodedRef = useRef<GpsPositionState | null>(null)
  const geocodeGenerationRef = useRef(0)
  const isFirstGeocodeRef = useRef(true)

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

      const delay = isFirstGeocodeRef.current ? 0 : GEOCODE_DEBOUNCE_MS
      isFirstGeocodeRef.current = false

      geocodeTimerRef.current = setTimeout(() => {
        void geocodeForPosition(pos)
      }, delay)
    },
    [geocodeForPosition]
  )

  useEffect(() => {
    if (!enabled) {
      setPhase('initializing')
      setPosition(null)
      setBestPosition(null)
      setAddress(null)
      setAddressLoading(false)
      setError(null)
      setTiming(EMPTY_TIMING)
      return
    }

    setPhase('initializing')
    setPosition(null)
    setBestPosition(null)
    setAddress(null)
    setAddressLoading(false)
    setError(null)
    setTiming(EMPTY_TIMING)
    lastGeocodedRef.current = null
    isFirstGeocodeRef.current = true
    geocodeGenerationRef.current += 1

    const session = startGpsWatch({
      maxWaitMs,
      onUpdate: (state) => {
        setPosition(state)
        setBestPosition(session.getBestPosition())
        setTiming(session.getTiming())
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
        setTiming(session.getTiming())
      },
      onTimeout: (state) => {
        setPosition(state)
        setBestPosition(state)
        setTiming(session.getTiming())
        scheduleGeocode(state)
        if (autoAcceptOnTimeout) {
          setPhase('relaxed')
        } else {
          setPhase('timeout_prompt')
        }
      },
      onError: (message) => {
        setError(message)
        setPhase('initializing')
      },
    })

    resetTimeoutRef.current = session.resetTimeout
    getBestPositionRef.current = session.getBestPosition
    getTimingRef.current = session.getTiming

    return () => {
      session.stop()
      resetTimeoutRef.current = null
      getBestPositionRef.current = null
      getTimingRef.current = null
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    }
  }, [enabled, maxWaitMs, autoAcceptOnTimeout, scheduleGeocode])

  const acceptRelaxedAccuracy = useCallback(() => {
    setPhase('relaxed')
    setError(null)
  }, [])

  const continueSearching = useCallback(() => {
    setPhase('waiting')
    setError(null)
    resetTimeoutRef.current?.()
  }, [])

  const getCurrentBestPosition = useCallback((): GpsPositionState | null => {
    return getBestPositionRef.current?.() ?? bestPosition ?? position
  }, [bestPosition, position])

  const hasLocation = getCurrentBestPosition() != null
  const accuracyReady =
    position != null && position.accuracy <= GPS_TARGET_ACCURACY_METERS

  /** Focení nikdy neblokuje čekáním na GPS – tlačítko je aktivní ihned po spuštění kamery. */
  const canCapture = true

  return {
    phase,
    position,
    bestPosition: getCurrentBestPosition(),
    address,
    addressLoading,
    error,
    timing,
    canCapture,
    accuracyReady,
    hasLocation,
    acceptRelaxedAccuracy,
    continueSearching,
    getCurrentBestPosition,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { reverseGeocode } from '@/lib/photos/geocoding'
import { geocodeFallbackAddress } from '@/lib/photos/photoDisplay'
import {
  classifyGpsAccuracy,
  formatAccuracyMeters,
  gpsAccuracyQualityLabel,
  type GpsAccuracyQuality,
  type GpsCaptureMetadata,
  toCaptureMetadata,
} from '@/lib/photos/gpsCapture'
import { type GpsPositionState, startGpsWatch } from '@/lib/photos/gpsWatch'
import type { GeocodedAddress } from '@/types/photos'

export type GpsPreflightPhase =
  | 'initializing'
  | 'searching'
  | 'precise'
  | 'acceptable'
  | 'low'
  | 'unavailable'
  | 'denied'

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

function phaseFromQuality(quality: GpsAccuracyQuality, hasPosition: boolean): GpsPreflightPhase {
  if (!hasPosition) return 'unavailable'
  switch (quality) {
    case 'precise':
      return 'precise'
    case 'acceptable':
      return 'acceptable'
    case 'low':
      return 'low'
    default:
      return 'unavailable'
  }
}

export function useGpsPreflight(enabled: boolean) {
  const [phase, setPhase] = useState<GpsPreflightPhase>('initializing')
  const [position, setPosition] = useState<GpsPositionState | null>(null)
  const [positionFromCache, setPositionFromCache] = useState(false)
  const [address, setAddress] = useState<GeocodedAddress | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refining, setRefining] = useState(false)

  const stopRef = useRef<(() => void) | null>(null)
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastGeocodedRef = useRef<GpsPositionState | null>(null)
  const geocodeGenerationRef = useRef(0)
  const hasPositionRef = useRef(false)

  const quality = classifyGpsAccuracy(position?.accuracy)
  const metadata: GpsCaptureMetadata = toCaptureMetadata(position, {
    fromCache: positionFromCache,
    source: positionFromCache ? 'cache' : position ? 'high_accuracy' : 'unavailable',
  })

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

  const startWatch = useCallback(() => {
    stopRef.current?.()
    setRefining(true)
    setError(null)
    setPhase('searching')

    const session = startGpsWatch({
      onCachedPosition: (state) => {
        hasPositionRef.current = true
        setPosition(state)
        setPositionFromCache(true)
        setPhase(phaseFromQuality(classifyGpsAccuracy(state.accuracy), true))
        scheduleGeocode(state)
      },
      onUpdate: (state) => {
        hasPositionRef.current = true
        setPosition(state)
        setPositionFromCache(false)
        const q = classifyGpsAccuracy(state.accuracy)
        setPhase(phaseFromQuality(q, true))
        scheduleGeocode(state)
      },
      onTargetReached: (state) => {
        hasPositionRef.current = true
        setPosition(state)
        setPositionFromCache(false)
        setPhase('precise')
        scheduleGeocode(state)
        setRefining(false)
      },
      onTimeout: (state) => {
        if (state) {
          hasPositionRef.current = true
          setPosition(state)
          setPositionFromCache(false)
          setPhase(phaseFromQuality(classifyGpsAccuracy(state.accuracy), true))
          scheduleGeocode(state)
        } else if (!hasPositionRef.current) {
          setPhase('unavailable')
        }
        setRefining(false)
      },
      onError: (message) => {
        setError(message)
        setPhase(message.includes('zamítnut') ? 'denied' : 'unavailable')
        setRefining(false)
      },
    })

    stopRef.current = session.stop
  }, [scheduleGeocode])

  useEffect(() => {
    if (!enabled) {
      stopRef.current?.()
      stopRef.current = null
      hasPositionRef.current = false
      setPhase('initializing')
      setPosition(null)
      setPositionFromCache(false)
      setAddress(null)
      setAddressLoading(false)
      setError(null)
      setRefining(false)
      return
    }

    startWatch()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        startWatch()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopRef.current?.()
      stopRef.current = null
      document.removeEventListener('visibilitychange', handleVisibility)
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    }
  }, [enabled, startWatch])

  const refineAccuracy = useCallback(() => {
    startWatch()
  }, [startWatch])

  const acceptLowAccuracy = useCallback(() => {
    setError(null)
  }, [])

  /** Focení je vždy povoleno – GPS se zpřesňuje na pozadí. */
  const canCapture = true

  const showLowAccuracyWarning = quality === 'low' && position != null
  const showUnavailableWarning = phase === 'unavailable' || phase === 'denied'

  return {
    phase,
    position,
    address,
    addressLoading,
    error,
    canCapture,
    quality,
    qualityLabel: gpsAccuracyQualityLabel(quality),
    accuracyLabel: formatAccuracyMeters(position?.accuracy),
    metadata,
    positionFromCache,
    refining,
    showLowAccuracyWarning,
    showUnavailableWarning,
    acceptRelaxedAccuracy: acceptLowAccuracy,
    continueSearching: refineAccuracy,
    refineAccuracy,
    accuracyReady: quality === 'precise',
  }
}

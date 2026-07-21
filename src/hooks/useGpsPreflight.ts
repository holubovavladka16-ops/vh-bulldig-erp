import { useCallback, useEffect, useRef, useState } from 'react'
import { GPS_TARGET_ACCURACY_METERS, reverseGeocode } from '@/lib/photos/geocoding'
import {
  ADDRESS_LOADING_LABEL,
  ADDRESS_UNAVAILABLE_LABEL,
  geocodeFallbackAddress,
} from '@/lib/photos/photoDisplay'
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

export type AddressStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

const GEOCODE_DEBOUNCE_MS = 1500
const GEOCODE_MIN_MOVE_M = 8
const GEOCODE_TIMEOUT_MS = 4000

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

async function reverseGeocodeWithTimeout(
  lat: number,
  lng: number,
  timeoutMs: number
): Promise<GeocodedAddress | null> {
  try {
    return await Promise.race([
      reverseGeocode(lat, lng),
      new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('geocode_timeout')), timeoutMs)
      }),
    ])
  } catch {
    return null
  }
}

export function getAddressDisplayLabel(
  address: GeocodedAddress | null,
  addressStatus: AddressStatus
): string {
  if (address?.address_full) return address.address_full
  if (addressStatus === 'loading') return ADDRESS_LOADING_LABEL
  if (addressStatus === 'unavailable') return ADDRESS_UNAVAILABLE_LABEL
  return '—'
}

export interface GpsPreflightOptions {
  /** Cílová přesnost v metrech (výchozí ±2 m). */
  maxAccuracyMeters?: number
  /** Vyžadovat dokončené načtení adresy před povolením capture. */
  requireAddressLoaded?: boolean
}

export function useGpsPreflight(enabled: boolean, options: GpsPreflightOptions = {}) {
  const maxAccuracyMeters = options.maxAccuracyMeters ?? GPS_TARGET_ACCURACY_METERS
  const requireAddressLoaded = options.requireAddressLoaded ?? false
  const [phase, setPhase] = useState<GpsPreflightPhase>('initializing')
  const [position, setPosition] = useState<GpsPositionState | null>(null)
  const [address, setAddress] = useState<GeocodedAddress | null>(null)
  const [addressStatus, setAddressStatus] = useState<AddressStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const resetTimeoutRef = useRef<(() => void) | null>(null)
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastGeocodedRef = useRef<GpsPositionState | null>(null)
  const geocodeGenerationRef = useRef(0)

  const geocodeForPosition = useCallback(async (pos: GpsPositionState) => {
    const generation = ++geocodeGenerationRef.current
    setAddressStatus('loading')
    try {
      const result = await reverseGeocodeWithTimeout(pos.lat, pos.lng, GEOCODE_TIMEOUT_MS)
      if (generation !== geocodeGenerationRef.current) return
      if (result) {
        setAddress(result)
        setAddressStatus('ready')
      } else {
        setAddress(null)
        setAddressStatus('unavailable')
      }
      lastGeocodedRef.current = pos
    } catch {
      if (generation !== geocodeGenerationRef.current) return
      setAddress(null)
      setAddressStatus('unavailable')
      lastGeocodedRef.current = pos
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
      setAddressStatus('idle')
      setError(null)
      return
    }

    setPhase('initializing')
    setPosition(null)
    setAddress(null)
    setAddressStatus('idle')
    setError(null)
    lastGeocodedRef.current = null
    geocodeGenerationRef.current += 1

    const session = startGpsWatch({
      onUpdate: (state) => {
        setPosition(state)
        setError(null)
        scheduleGeocode(state)

        if (state.accuracy <= maxAccuracyMeters) {
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
  }, [enabled, maxAccuracyMeters, scheduleGeocode])

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
  const accuracyOk = position != null && position.accuracy <= maxAccuracyMeters
  const addressLoaded =
    !requireAddressLoaded || addressStatus === 'ready' || addressStatus === 'unavailable'
  const canCapture =
    hasLocation &&
    accuracyOk &&
    addressLoaded &&
    (phase === 'ready' || (!requireAddressLoaded && phase === 'relaxed'))
  const addressLoading = addressStatus === 'loading'
  const addressDisplayLabel = getAddressDisplayLabel(address, addressStatus)

  /** Adresa pro uložení snímku — geokód, fallback souřadnic, nebo placeholder. */
  const resolveAddressForCapture = useCallback((): GeocodedAddress => {
    if (address) return address
    if (position) return geocodeFallbackAddress(position.lat, position.lng)
    return geocodeFallbackAddress()
  }, [address, position])

  return {
    phase,
    position,
    address,
    addressStatus,
    addressLoading,
    addressDisplayLabel,
    resolveAddressForCapture,
    error,
    canCapture,
    accuracyReady: position != null && position.accuracy <= maxAccuracyMeters,
    maxAccuracyMeters,
    acceptRelaxedAccuracy,
    continueSearching,
  }
}

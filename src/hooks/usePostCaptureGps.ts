import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GPS_EXCELLENT_ACCURACY_METERS,
  GPS_PHOTO_SAVE_MAX_ACCURACY_METERS,
  reverseGeocode,
} from '@/lib/photos/geocoding'
import { geocodeFallbackAddress } from '@/lib/photos/photoDisplay'
import { startPostCaptureGpsWatch, type GpsPositionState } from '@/lib/photos/gpsWatch'
import type { GeocodedAddress } from '@/types/photos'

export type PostCaptureGpsPhase =
  | 'idle'
  | 'locating'
  | 'refining'
  | 'geocoding'
  | 'ready'
  | 'imprecise'
  | 'error'

const GEOCODE_DEBOUNCE_MS = 1200
const GEOCODE_MIN_MOVE_M = 6

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

export function getPostCaptureStatusLabel(phase: PostCaptureGpsPhase): string {
  switch (phase) {
    case 'locating':
      return 'Zjišťuji přesnou polohu…'
    case 'refining':
      return 'Upřesňuji GPS…'
    case 'geocoding':
      return 'Načítám adresu…'
    case 'ready':
      return 'Poloha připravena'
    case 'imprecise':
      return 'Upřesňuji GPS…'
    case 'error':
      return 'Chyba získání polohy'
    default:
      return ''
  }
}

export function formatAccuracyLabel(accuracy: number | null | undefined): string {
  if (accuracy == null) return '—'
  return `±${accuracy < 10 ? accuracy.toFixed(1) : Math.round(accuracy)} m`
}

export function getAccuracyQuality(accuracy: number | null | undefined): 'excellent' | 'acceptable' | 'imprecise' | 'unknown' {
  if (accuracy == null) return 'unknown'
  if (accuracy <= GPS_EXCELLENT_ACCURACY_METERS) return 'excellent'
  if (accuracy <= GPS_PHOTO_SAVE_MAX_ACCURACY_METERS) return 'acceptable'
  return 'imprecise'
}

export function usePostCaptureGps(enabled: boolean) {
  const [phase, setPhase] = useState<PostCaptureGpsPhase>('idle')
  const [position, setPosition] = useState<GpsPositionState | null>(null)
  const [address, setAddress] = useState<GeocodedAddress | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastGeocodedRef = useRef<GpsPositionState | null>(null)
  const geocodeGenerationRef = useRef(0)

  const geocodeForPosition = useCallback(async (pos: GpsPositionState) => {
    const generation = ++geocodeGenerationRef.current
    setAddressLoading(true)
    setPhase((current) =>
      current === 'error' ? current : pos.accuracy <= GPS_PHOTO_SAVE_MAX_ACCURACY_METERS ? 'geocoding' : 'imprecise'
    )
    try {
      const result = await reverseGeocode(pos.lat, pos.lng)
      if (generation !== geocodeGenerationRef.current) return
      setAddress(result)
      lastGeocodedRef.current = pos
      setPhase(pos.accuracy <= GPS_PHOTO_SAVE_MAX_ACCURACY_METERS ? 'ready' : 'imprecise')
    } catch {
      if (generation !== geocodeGenerationRef.current) return
      setAddress(geocodeFallbackAddress(pos.lat, pos.lng))
      lastGeocodedRef.current = pos
      setPhase(pos.accuracy <= GPS_PHOTO_SAVE_MAX_ACCURACY_METERS ? 'ready' : 'imprecise')
    } finally {
      if (generation === geocodeGenerationRef.current) {
        setAddressLoading(false)
      }
    }
  }, [])

  const scheduleGeocode = useCallback(
    (pos: GpsPositionState) => {
      const last = lastGeocodedRef.current
      if (last && distanceMeters(last, pos) < GEOCODE_MIN_MOVE_M && pos.accuracy >= last.accuracy) {
        return
      }

      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
      geocodeTimerRef.current = setTimeout(() => {
        void geocodeForPosition(pos)
      }, GEOCODE_DEBOUNCE_MS)
    },
    [geocodeForPosition]
  )

  useEffect(() => {
    if (!enabled) {
      setPhase('idle')
      setPosition(null)
      setAddress(null)
      setAddressLoading(false)
      setError(null)
      lastGeocodedRef.current = null
      geocodeGenerationRef.current += 1
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
      return
    }

    setPhase('locating')
    setPosition(null)
    setAddress(null)
    setAddressLoading(false)
    setError(null)
    lastGeocodedRef.current = null
    geocodeGenerationRef.current += 1

    const session = startPostCaptureGpsWatch({
      onUpdate: (state) => {
        setPosition(state)
        setError(null)
        scheduleGeocode(state)

        if (state.accuracy <= GPS_PHOTO_SAVE_MAX_ACCURACY_METERS) {
          setPhase((current) => (current === 'geocoding' || current === 'ready' ? current : 'geocoding'))
        } else {
          setPhase('refining')
        }
      },
      onError: (message) => {
        setError(message)
        setPhase('error')
      },
    })

    return () => {
      session.stop()
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current)
    }
  }, [enabled, scheduleGeocode])

  const canSave =
    position != null &&
    position.accuracy <= GPS_PHOTO_SAVE_MAX_ACCURACY_METERS &&
    address != null &&
    !addressLoading

  const isImprecise = position != null && position.accuracy > GPS_PHOTO_SAVE_MAX_ACCURACY_METERS

  return {
    phase,
    position,
    address,
    addressLoading,
    error,
    canSave,
    isImprecise,
    statusLabel: getPostCaptureStatusLabel(phase),
    accuracyQuality: getAccuracyQuality(position?.accuracy),
  }
}

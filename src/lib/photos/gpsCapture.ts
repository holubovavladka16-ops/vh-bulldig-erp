import type { GpsPositionState } from '@/lib/photos/gpsWatch'

/** Maximální čekání na high-accuracy GPS při focení (ms). */
export const GPS_CAPTURE_TIMEOUT_MS = 5_000

/** Přesná poloha: 0–5 m (pouze pokud ji zařízení skutečně hlásí). */
export const GPS_PRECISE_MAX_METERS = 5

/** Přijatelná poloha: 5–15 m. */
export const GPS_ACCEPTABLE_MAX_METERS = 15

const GPS_CACHE_KEY = 'vh-bulldig-gps-cache'
const GPS_CACHE_MAX_AGE_MS = 30 * 60 * 1000

export type GpsAccuracyQuality = 'precise' | 'acceptable' | 'low' | 'unavailable'

export type GpsLocationSource =
  | 'cache'
  | 'cached_device'
  | 'high_accuracy'
  | 'low_accuracy'
  | 'unavailable'

export interface GpsCaptureMetadata {
  lat: number | null
  lng: number | null
  accuracy: number | null
  obtainedAt: string | null
  source: GpsLocationSource
  fromCache: boolean
  quality: GpsAccuracyQuality
}

interface CachedGpsPayload {
  lat: number
  lng: number
  accuracy: number
  heading: number | null
  timestamp: number
  savedAt: number
}

export function classifyGpsAccuracy(accuracy: number | null | undefined): GpsAccuracyQuality {
  if (accuracy == null || !Number.isFinite(accuracy)) return 'unavailable'
  if (accuracy <= GPS_PRECISE_MAX_METERS) return 'precise'
  if (accuracy <= GPS_ACCEPTABLE_MAX_METERS) return 'acceptable'
  return 'low'
}

export function gpsAccuracyQualityLabel(quality: GpsAccuracyQuality): string {
  switch (quality) {
    case 'precise':
      return 'Přesná poloha (0–5 m)'
    case 'acceptable':
      return 'Přijatelná poloha (5–15 m)'
    case 'low':
      return 'Nízká přesnost (>15 m)'
    default:
      return 'GPS nedostupná'
  }
}

export function readCachedGpsPosition(): GpsPositionState | null {
  try {
    const raw = localStorage.getItem(GPS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedGpsPayload
    if (!parsed?.lat || !parsed?.lng || !parsed.savedAt) return null
    if (Date.now() - parsed.savedAt > GPS_CACHE_MAX_AGE_MS) return null
    return {
      lat: parsed.lat,
      lng: parsed.lng,
      accuracy: parsed.accuracy,
      heading: parsed.heading,
      timestamp: parsed.timestamp,
    }
  } catch {
    return null
  }
}

export function writeCachedGpsPosition(state: GpsPositionState): void {
  try {
    const payload: CachedGpsPayload = {
      lat: state.lat,
      lng: state.lng,
      accuracy: state.accuracy,
      heading: state.heading,
      timestamp: state.timestamp,
      savedAt: Date.now(),
    }
    localStorage.setItem(GPS_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // localStorage může být nedostupné
  }
}

export function toCaptureMetadata(
  state: GpsPositionState | null,
  options: { source?: GpsLocationSource; fromCache?: boolean } = {}
): GpsCaptureMetadata {
  if (!state) {
    return {
      lat: null,
      lng: null,
      accuracy: null,
      obtainedAt: null,
      source: 'unavailable',
      fromCache: false,
      quality: 'unavailable',
    }
  }

  const fromCache = options.fromCache ?? options.source === 'cache'
  const source =
    options.source ??
    (fromCache ? 'cache' : state.accuracy <= GPS_PRECISE_MAX_METERS ? 'high_accuracy' : 'low_accuracy')

  return {
    lat: state.lat,
    lng: state.lng,
    accuracy: state.accuracy,
    obtainedAt: new Date(state.timestamp).toISOString(),
    source,
    fromCache,
    quality: classifyGpsAccuracy(state.accuracy),
  }
}

export function formatAccuracyMeters(accuracy: number | null | undefined): string {
  if (accuracy == null || !Number.isFinite(accuracy)) return '—'
  return `±${accuracy < 10 ? accuracy.toFixed(1) : Math.round(accuracy)} m`
}

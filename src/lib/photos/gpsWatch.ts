import {
  GPS_CAPTURE_TIMEOUT_MS,
  readCachedGpsPosition,
  writeCachedGpsPosition,
} from '@/lib/photos/gpsCapture'

export { GPS_CAPTURE_TIMEOUT_MS as GPS_MAX_WAIT_MS }

export interface GpsPositionState {
  lat: number
  lng: number
  accuracy: number
  heading: number | null
  timestamp: number
}

export interface StartGpsWatchOptions {
  onUpdate: (state: GpsPositionState) => void
  onTargetReached?: (state: GpsPositionState) => void
  onTimeout: (state: GpsPositionState | null) => void
  onError: (message: string) => void
  /** Okamžitě vrátí poslední známou polohu z cache (localStorage). */
  onCachedPosition?: (state: GpsPositionState) => void
}

function toState(position: GeolocationPosition): GpsPositionState {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: position.coords.heading,
    timestamp: position.timestamp,
  }
}

/**
 * Průběžné sledování GPS – nejdřív cache, pak high-accuracy, timeout 5 s.
 * Focení nikdy neblokuje – volající rozhodne, jak výsledek použít.
 */
export function startGpsWatch(options: StartGpsWatchOptions): {
  stop: () => void
  resetTimeout: () => void
} {
  const { onUpdate, onTargetReached, onTimeout, onError, onCachedPosition } = options

  if (!navigator.geolocation) {
    onError('GPS není v prohlížeči dostupné.')
    return { stop: () => undefined, resetTimeout: () => undefined }
  }

  let watchId: number | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let best: GeolocationPosition | null = null
  let targetReached = false
  let timeoutFired = false
  let stopped = false

  const cached = readCachedGpsPosition()
  if (cached) {
    onCachedPosition?.(cached)
    onUpdate(cached)
    best = {
      coords: {
        latitude: cached.lat,
        longitude: cached.lng,
        accuracy: cached.accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: cached.heading,
        speed: null,
      },
      timestamp: cached.timestamp,
    } as GeolocationPosition
  }

  const clearAll = () => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId)
    if (timeoutId != null) clearTimeout(timeoutId)
    watchId = null
    timeoutId = null
  }

  const fireTimeout = () => {
    if (stopped || targetReached || timeoutFired) return
    timeoutFired = true
    if (best) {
      const state = toState(best)
      writeCachedGpsPosition(state)
      onTimeout(state)
    } else {
      onTimeout(null)
    }
  }

  const scheduleTimeout = () => {
    if (timeoutId != null) clearTimeout(timeoutId)
    timeoutFired = false
    timeoutId = setTimeout(fireTimeout, GPS_CAPTURE_TIMEOUT_MS)
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (stopped) return
      if (!best || position.coords.accuracy < best.coords.accuracy) {
        best = position
      }
      const state = toState(position)
      writeCachedGpsPosition(state)
      onUpdate(state)
    },
    () => {
      // Tiché selhání – pokračujeme watchPosition
    },
    { enableHighAccuracy: false, maximumAge: 120_000, timeout: 3000 }
  )

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (stopped) return

      if (!best || position.coords.accuracy < best.coords.accuracy) {
        best = position
      }

      const state = toState(position)
      writeCachedGpsPosition(state)
      onUpdate(state)

      if (!targetReached && onTargetReached && position.coords.accuracy <= 5) {
        targetReached = true
        if (timeoutId != null) clearTimeout(timeoutId)
        onTargetReached(state)
      }
    },
    (error) => {
      if (stopped) return
      if (best) {
        onUpdate(toState(best))
        return
      }
      const code = error.code
      if (code === error.PERMISSION_DENIED) {
        onError('Přístup k poloze byl zamítnut. Povolte GPS v prohlížeči a v nastavení telefonu.')
      } else if (code === error.POSITION_UNAVAILABLE) {
        onError('GPS signál není dostupný. Zkuste se přesunout blíže k oknu nebo ven.')
      } else {
        onError(error.message || 'Polohu se nepodařilo získat.')
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 15_000,
      timeout: GPS_CAPTURE_TIMEOUT_MS,
    }
  )

  scheduleTimeout()

  return {
    stop: () => {
      stopped = true
      clearAll()
    },
    resetTimeout: () => {
      if (stopped || targetReached) return
      scheduleTimeout()
    },
  }
}

export function getDeviceOrientation(): number | null {
  if (typeof screen !== 'undefined' && screen.orientation?.angle != null) {
    return screen.orientation.angle
  }
  const legacy = (window as Window & { orientation?: number }).orientation
  if (typeof legacy === 'number' && !Number.isNaN(legacy)) {
    return legacy
  }
  return null
}

export function formatDeviceOrientation(degrees: number | null): string {
  if (degrees == null) return '—'
  const normalized = ((degrees % 360) + 360) % 360
  if (normalized === 0 || normalized === 180) return 'Na výšku'
  if (normalized === 90 || normalized === 270) return 'Na šířku'
  return `${Math.round(normalized)}°`
}

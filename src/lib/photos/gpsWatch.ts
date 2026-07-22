import { GPS_TARGET_ACCURACY_METERS } from '@/lib/photos/geocoding'

export const GPS_MAX_WAIT_MS = 30_000

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: GPS_MAX_WAIT_MS,
}

export function checkGeolocationSupport(): string | null {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'GPS vyžaduje zabezpečené připojení (HTTPS). Otevřete aplikaci přes https:// adresu.'
  }
  if (!navigator.geolocation) {
    return 'GPS není v tomto prohlížeči dostupné.'
  }
  return null
}

export function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Přístup k poloze byl zamítnut. Povolte polohu v prohlížeči a v nastavení zařízení.'
    case error.POSITION_UNAVAILABLE:
      return 'Poloha není dostupná. Zapněte GPS / přesnou polohu v nastavení telefonu.'
    case error.TIMEOUT:
      return 'Vypršel čas pro získání GPS. Přesuňte se na volné prostranství a zkuste znovu.'
    default:
      return error.message || 'Polohu se nepodařilo získat. Povolte GPS.'
  }
}

export interface GpsPositionState {
  lat: number
  lng: number
  accuracy: number
  heading: number | null
  timestamp: number
}

export interface StartGpsWatchOptions {
  onUpdate: (state: GpsPositionState) => void
  onTargetReached: (state: GpsPositionState) => void
  onTimeout: (state: GpsPositionState) => void
  onError: (message: string) => void
  /** Cílová přesnost v metrech (výchozí GPS_TARGET_ACCURACY_METERS). */
  targetAccuracyMeters?: number
  /** Přijmout cacheovanou polohu pro rychlejší první fix (ms). */
  maximumAgeMs?: number
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

/** Průběžné sledování GPS – aktualizace v reálném čase, cílová přesnost, timeout 30 s. */
export function startGpsWatch(options: StartGpsWatchOptions): {
  stop: () => void
  resetTimeout: () => void
} {
  const {
    onUpdate,
    onTargetReached,
    onTimeout,
    onError,
    targetAccuracyMeters = GPS_TARGET_ACCURACY_METERS,
    maximumAgeMs = 0,
  } = options

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

  const clearAll = () => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId)
    if (timeoutId != null) clearTimeout(timeoutId)
    watchId = null
    timeoutId = null
  }

  const fireTimeout = () => {
    if (stopped || targetReached || timeoutFired) return
    timeoutFired = true
    if (best) onTimeout(toState(best))
    else onError('Polohu se nepodařilo získat. Povolte GPS v prohlížeči a v nastavení telefonu.')
  }

  const scheduleTimeout = () => {
    if (timeoutId != null) clearTimeout(timeoutId)
    timeoutFired = false
    timeoutId = setTimeout(fireTimeout, GPS_MAX_WAIT_MS)
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (stopped) return

      if (!best || position.coords.accuracy < best.coords.accuracy) {
        best = position
      }

      const state = toState(position)
      onUpdate(state)

      if (!targetReached && position.coords.accuracy <= targetAccuracyMeters) {
        targetReached = true
        if (timeoutId != null) clearTimeout(timeoutId)
        onTargetReached(state)
      }
    },
    (error) => {
      if (stopped) return
      onError(error.message || 'Polohu se nepodařilo získat. Povolte GPS.')
    },
    {
      enableHighAccuracy: true,
      maximumAge: maximumAgeMs,
      timeout: GPS_MAX_WAIT_MS,
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

/**
 * Okamžité zaměření pro modul výkopů / přípojek:
 * 1) getCurrentPosition pro rychlý první fix
 * 2) watchPosition pro průběžné aktualizace
 */
export function startGpsLocateSession(options: {
  onUpdate: (state: GpsPositionState) => void
  onError: (message: string) => void
  maximumAgeMs?: number
}): { stop: () => void } {
  const { onUpdate, onError, maximumAgeMs = 0 } = options

  const supportError = checkGeolocationSupport()
  if (supportError) {
    onError(supportError)
    return { stop: () => undefined }
  }

  let watchId: number | null = null
  let stopped = false
  let receivedFix = false

  const geoOptions: PositionOptions = {
    ...GEO_OPTIONS,
    maximumAge: maximumAgeMs,
  }

  const handleSuccess = (position: GeolocationPosition) => {
    if (stopped) return
    receivedFix = true
    onUpdate(toState(position))
  }

  const handleError = (error: GeolocationPositionError) => {
    if (stopped) return
    if (receivedFix && error.code === error.TIMEOUT) return
    onError(getGeolocationErrorMessage(error))
  }

  navigator.geolocation.getCurrentPosition(handleSuccess, (error) => {
    if (stopped) return
    if (error.code === error.PERMISSION_DENIED) {
      handleError(error)
    }
  }, geoOptions)

  watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions)

  return {
    stop: () => {
      stopped = true
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      watchId = null
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

import { GPS_TARGET_ACCURACY_METERS } from '@/lib/photos/geocoding'

/** Výchozí timeout pro výkopy a jiné moduly (s). */
export const GPS_MAX_WAIT_MS = 30_000

/** Timeout pro fotodokumentaci – max. čekání na nejlepší polohu (s). */
export const GPS_PHOTO_MAX_WAIT_MS = 5_000

export interface GpsPositionState {
  lat: number
  lng: number
  accuracy: number
  heading: number | null
  timestamp: number
}

export interface GpsTimingMetrics {
  /** Čas do první GPS opravy (ms), null pokud žádná. */
  firstFixMs: number | null
  /** Čas do dosažení cílové přesnosti (ms), null pokud nedosaženo. */
  targetReachedMs: number | null
  /** Čas do vypršení timeoutu / ustálení polohy (ms). */
  settledMs: number | null
  /** Přesnost při ustálení (m). */
  settledAccuracy: number | null
}

export interface StartGpsWatchOptions {
  onUpdate: (state: GpsPositionState) => void
  onTargetReached: (state: GpsPositionState) => void
  onTimeout: (state: GpsPositionState) => void
  onError: (message: string) => void
  /** Vlastní timeout v ms (výchozí GPS_MAX_WAIT_MS). */
  maxWaitMs?: number
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

/** Průběžné sledování GPS – aktualizace v reálném čase, cíl ±2 m, konfigurovatelný timeout. */
export function startGpsWatch(options: StartGpsWatchOptions): {
  stop: () => void
  resetTimeout: () => void
  getBestPosition: () => GpsPositionState | null
  getTiming: () => GpsTimingMetrics
} {
  const { onUpdate, onTargetReached, onTimeout, onError, maxWaitMs = GPS_MAX_WAIT_MS } = options

  if (!navigator.geolocation) {
    onError('GPS není v prohlížeči dostupné.')
    return {
      stop: () => undefined,
      resetTimeout: () => undefined,
      getBestPosition: () => null,
      getTiming: () => ({
        firstFixMs: null,
        targetReachedMs: null,
        settledMs: null,
        settledAccuracy: null,
      }),
    }
  }

  let watchId: number | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let best: GeolocationPosition | null = null
  let targetReached = false
  let timeoutFired = false
  let stopped = false
  const startedAt = Date.now()
  let firstFixMs: number | null = null
  let targetReachedMs: number | null = null
  let settledMs: number | null = null

  const clearAll = () => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId)
    if (timeoutId != null) clearTimeout(timeoutId)
    watchId = null
    timeoutId = null
  }

  const fireTimeout = () => {
    if (stopped || targetReached || timeoutFired) return
    timeoutFired = true
    settledMs = Date.now() - startedAt
    if (best) onTimeout(toState(best))
    else onError('Polohu se nepodařilo získat. Povolte GPS v prohlížeči a v nastavení telefonu.')
  }

  const scheduleTimeout = () => {
    if (timeoutId != null) clearTimeout(timeoutId)
    timeoutFired = false
    timeoutId = setTimeout(fireTimeout, maxWaitMs)
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (stopped) return

      if (firstFixMs == null) {
        firstFixMs = Date.now() - startedAt
      }

      if (!best || position.coords.accuracy < best.coords.accuracy) {
        best = position
      }

      const state = toState(position)
      onUpdate(state)

      if (!targetReached && position.coords.accuracy <= GPS_TARGET_ACCURACY_METERS) {
        targetReached = true
        targetReachedMs = Date.now() - startedAt
        settledMs = targetReachedMs
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
      maximumAge: 0,
      timeout: maxWaitMs,
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
    getBestPosition: () => (best ? toState(best) : null),
    getTiming: () => ({
      firstFixMs,
      targetReachedMs,
      settledMs,
      settledAccuracy: best?.coords.accuracy ?? null,
    }),
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

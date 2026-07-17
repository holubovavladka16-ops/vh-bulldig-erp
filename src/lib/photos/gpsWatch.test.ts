import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GPS_PHOTO_MAX_WAIT_MS,
  startGpsWatch,
  type GpsPositionState,
} from '@/lib/photos/gpsWatch'
import { GPS_TARGET_ACCURACY_METERS } from '@/lib/photos/geocoding'

function makePosition(
  lat: number,
  lng: number,
  accuracy: number,
  timestamp = Date.now()
): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp,
  } as GeolocationPosition
}

describe('startGpsWatch', () => {
  let watchCallback: ((position: GeolocationPosition) => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    watchCallback = null

    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: vi.fn((success) => {
          watchCallback = success
          return 1
        }),
        clearWatch: vi.fn(),
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('uses 5 s default timeout for photo documentation constant', () => {
    expect(GPS_PHOTO_MAX_WAIT_MS).toBe(5000)
  })

  it('reports first fix timing without blocking', () => {
    const updates: GpsPositionState[] = []
    const session = startGpsWatch({
      maxWaitMs: GPS_PHOTO_MAX_WAIT_MS,
      onUpdate: (state) => updates.push(state),
      onTargetReached: vi.fn(),
      onTimeout: vi.fn(),
      onError: vi.fn(),
    })

    vi.advanceTimersByTime(1200)
    watchCallback?.(makePosition(50.08, 14.42, 45))

    const timing = session.getTiming()
    expect(timing.firstFixMs).toBe(1200)
    expect(updates).toHaveLength(1)
    expect(updates[0].accuracy).toBe(45)
    expect(session.getBestPosition()?.accuracy).toBe(45)
  })

  it('tracks best accuracy across updates', () => {
    const session = startGpsWatch({
      maxWaitMs: GPS_PHOTO_MAX_WAIT_MS,
      onUpdate: vi.fn(),
      onTargetReached: vi.fn(),
      onTimeout: vi.fn(),
      onError: vi.fn(),
    })

    watchCallback?.(makePosition(50.08, 14.42, 80))
    watchCallback?.(makePosition(50.081, 14.421, 25))
    watchCallback?.(makePosition(50.0815, 14.4215, 40))

    expect(session.getBestPosition()?.accuracy).toBe(25)
  })

  it('fires onTargetReached when accuracy meets target', () => {
    const onTargetReached = vi.fn()
    startGpsWatch({
      maxWaitMs: GPS_PHOTO_MAX_WAIT_MS,
      onUpdate: vi.fn(),
      onTargetReached,
      onTimeout: vi.fn(),
      onError: vi.fn(),
    })

    watchCallback?.(makePosition(50.08, 14.42, 50))
    watchCallback?.(makePosition(50.08001, 14.42001, GPS_TARGET_ACCURACY_METERS))

    expect(onTargetReached).toHaveBeenCalledOnce()
    expect(onTargetReached.mock.calls[0][0].accuracy).toBe(GPS_TARGET_ACCURACY_METERS)
  })

  it('fires onTimeout with best position after 5 s without target accuracy', () => {
    const onTimeout = vi.fn()
    const session = startGpsWatch({
      maxWaitMs: GPS_PHOTO_MAX_WAIT_MS,
      onUpdate: vi.fn(),
      onTargetReached: vi.fn(),
      onTimeout,
      onError: vi.fn(),
    })

    vi.advanceTimersByTime(800)
    watchCallback?.(makePosition(50.08, 14.42, 60))
    vi.advanceTimersByTime(2000)
    watchCallback?.(makePosition(50.081, 14.421, 18))

    vi.advanceTimersByTime(5000)

    expect(onTimeout).toHaveBeenCalledOnce()
    expect(onTimeout.mock.calls[0][0].accuracy).toBe(18)
    expect(session.getTiming().settledMs).toBe(5000)
    expect(session.getTiming().targetReachedMs).toBeNull()
  })

  it('simulates Android-like GPS load profile under 5 s', () => {
    const onTimeout = vi.fn()
    const onTargetReached = vi.fn()
    const timings: number[] = []

    const session = startGpsWatch({
      maxWaitMs: GPS_PHOTO_MAX_WAIT_MS,
      onUpdate: (state) => timings.push(state.accuracy),
      onTargetReached,
      onTimeout,
      onError: vi.fn(),
    })

    // Android coarse fix ~1.2 s
    vi.advanceTimersByTime(1200)
    watchCallback?.(makePosition(50.087, 14.421, 120))

    // Refinement ~2.8 s
    vi.advanceTimersByTime(1600)
    watchCallback?.(makePosition(50.0871, 14.4211, 35))

    // Further refinement ~4.1 s
    vi.advanceTimersByTime(1300)
    watchCallback?.(makePosition(50.08711, 14.42111, 12))

    vi.advanceTimersByTime(5000)

    const timing = session.getTiming()
    expect(timing.firstFixMs).toBe(1200)
    expect(onTargetReached).not.toHaveBeenCalled()
    expect(onTimeout).toHaveBeenCalledOnce()
    expect(onTimeout.mock.calls[0][0].accuracy).toBe(12)
    expect(timings).toEqual([120, 35, 12])
  })

  it('simulates Android fast precise fix under 3 s', () => {
    const onTargetReached = vi.fn()

    const session = startGpsWatch({
      maxWaitMs: GPS_PHOTO_MAX_WAIT_MS,
      onUpdate: vi.fn(),
      onTargetReached,
      onTimeout: vi.fn(),
      onError: vi.fn(),
    })

    vi.advanceTimersByTime(900)
    watchCallback?.(makePosition(50.087, 14.421, 80))
    vi.advanceTimersByTime(1800)
    watchCallback?.(makePosition(50.0871, 14.4211, 1.8))

    expect(onTargetReached).toHaveBeenCalledOnce()
    expect(session.getTiming().targetReachedMs).toBe(2700)
    expect(session.getTiming().firstFixMs).toBe(900)
  })

  it('reports error when no fix within timeout', () => {
    const onError = vi.fn()
    startGpsWatch({
      maxWaitMs: GPS_PHOTO_MAX_WAIT_MS,
      onUpdate: vi.fn(),
      onTargetReached: vi.fn(),
      onTimeout: vi.fn(),
      onError,
    })

    vi.advanceTimersByTime(5000)

    expect(onError).toHaveBeenCalledOnce()
  })
})

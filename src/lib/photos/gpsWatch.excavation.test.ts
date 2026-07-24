import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  checkGeolocationSupport,
  getGeolocationErrorMessage,
  startGpsLocateSession,
} from '@/lib/photos/gpsWatch'

describe('gpsWatch excavation locate', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: {
              latitude: 50.0755,
              longitude: 14.4378,
              accuracy: 12,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition)
        }),
        watchPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: {
              latitude: 50.0755,
              longitude: 14.4378,
              accuracy: 8,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition)
          return 1
        }),
        clearWatch: vi.fn(),
      },
    })
    vi.stubGlobal('window', { isSecureContext: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checkGeolocationSupport returns null when geolocation is available', () => {
    expect(checkGeolocationSupport()).toBeNull()
  })

  it('getGeolocationErrorMessage maps permission denied', () => {
    const error = {
      code: 1,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
      message: 'denied',
    } as GeolocationPositionError
    expect(getGeolocationErrorMessage(error)).toContain('zamítnut')
  })

  it('startGpsLocateSession calls getCurrentPosition and watchPosition', () => {
    const onUpdate = vi.fn()
    const session = startGpsLocateSession({ onUpdate, onError: vi.fn() })

    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalled()
    expect(navigator.geolocation.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true })
    )
    expect(onUpdate).toHaveBeenCalled()
    expect(onUpdate.mock.calls[0][0]).toMatchObject({
      lat: 50.0755,
      lng: 14.4378,
      accuracy: 12,
    })

    session.stop()
    expect(navigator.geolocation.clearWatch).toHaveBeenCalledWith(1)
  })
})

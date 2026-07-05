import type { GeocodedAddress } from '@/types/photos'

interface NominatimAddress {
  road?: string
  house_number?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  postcode?: string
  country?: string
}

/** Požadovaná přesnost GPS pro fotodokumentaci (metry). */
export const GPS_TARGET_ACCURACY_METERS = 2

const GPS_MAX_WAIT_MS = 30000

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedAddress> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'cs')

  const response = await fetch(url.toString(), {
    headers: { 'Accept-Language': 'cs' },
  })

  if (!response.ok) {
    throw new Error('Adresu se nepodařilo načíst z GPS souřadnic.')
  }

  const data = (await response.json()) as {
    display_name?: string
    address?: NominatimAddress
  }

  const address = data.address ?? {}
  const streetParts = [address.road, address.house_number].filter(Boolean)
  const city = address.city ?? address.town ?? address.village ?? address.municipality ?? ''

  return {
    address_full: data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    street: streetParts.join(' '),
    city,
    postal_code: address.postcode ?? '',
    country: address.country ?? '',
  }
}

export interface GpsCaptureResult {
  lat: number
  lng: number
  accuracy: number
}

export type GpsCaptureProgress = (accuracy: number | null) => void

/**
 * Sleduje GPS dokud nedosáhne požadované přesnosti ±2 m, nebo vyprší časový limit.
 */
export function captureHighAccuracyPosition(onProgress?: GpsCaptureProgress): Promise<GpsCaptureResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS není v prohlížeči dostupné.'))
      return
    }

    let best: GeolocationPosition | null = null
    let watchId: number | null = null

    const finish = (position: GeolocationPosition) => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      clearTimeout(timeoutId)
      resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      })
    }

    const fail = (message: string) => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      clearTimeout(timeoutId)
      reject(new Error(message))
    }

    const timeoutId = setTimeout(() => {
      if (best && best.coords.accuracy <= GPS_TARGET_ACCURACY_METERS) {
        finish(best)
        return
      }
      if (best) {
        fail(
          `GPS přesnost ±${Math.round(best.coords.accuracy)} m nedosahuje požadovaných ±${GPS_TARGET_ACCURACY_METERS} m. ` +
            'Přesuňte se na volné prostranství, zapněte přesnou polohu a zkuste znovu.'
        )
        return
      }
      fail('Polohu se nepodařilo získat. Povolte GPS v prohlížeči a v nastavení telefonu.')
    }, GPS_MAX_WAIT_MS)

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!best || position.coords.accuracy < best.coords.accuracy) {
          best = position
        }
        onProgress?.(position.coords.accuracy)

        if (position.coords.accuracy <= GPS_TARGET_ACCURACY_METERS) {
          finish(position)
        }
      },
      (error) => {
        fail(error.message || 'Polohu se nepodařilo získat. Povolte GPS.')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: GPS_MAX_WAIT_MS,
      }
    )
  })
}

/** @deprecated Prefer captureHighAccuracyPosition */
export function captureCurrentPosition(): Promise<GeolocationPosition> {
  return captureHighAccuracyPosition().then((result) => ({
    coords: {
      latitude: result.lat,
      longitude: result.lng,
      accuracy: result.accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  } as GeolocationPosition))
}

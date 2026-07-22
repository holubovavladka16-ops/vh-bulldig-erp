import type { GeocodedAddress } from '@/types/photos'
import { geocodeFallbackAddress } from '@/lib/photos/photoDisplay'
import { GPS_MAX_WAIT_MS } from '@/lib/photos/gpsWatch'

export { GPS_MAX_WAIT_MS }

interface NominatimAddress {
  road?: string
  house_number?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
  state?: string
  postcode?: string
  country?: string
}

/** Požadovaná přesnost GPS pro výkopy a starší preflight logiku (metry). */
export const GPS_TARGET_ACCURACY_METERS = 2

/** GPS fotografie – výborná přesnost (metry). */
export const GPS_EXCELLENT_ACCURACY_METERS = 5

/** GPS fotografie – maximální přesnost pro uložení bez varování (metry). */
export const GPS_PHOTO_SAVE_MAX_ACCURACY_METERS = 10

const GPS_CAPTURE_MAX_WAIT_MS = GPS_MAX_WAIT_MS

export interface ForwardGeocodeResult {
  lat: number
  lng: number
  display_name: string
}

/** Vyhledání adresy → souřadnice (OpenStreetMap Nominatim). */
export async function forwardGeocode(query: string): Promise<ForwardGeocodeResult | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const fromProxy = await forwardGeocodeViaProxy(trimmed)
  if (fromProxy) return fromProxy

  return forwardGeocodeDirect(trimmed)
}

async function forwardGeocodeViaProxy(query: string): Promise<ForwardGeocodeResult | null> {
  try {
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
    })

    if (response.status === 404) return null
    if (!response.ok) return null

    const data = (await response.json()) as { lat?: number; lng?: number; display_name?: string }
    if (data.lat == null || data.lng == null) return null
    if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return null

    return {
      lat: data.lat,
      lng: data.lng,
      display_name: data.display_name?.trim() || query,
    }
  } catch {
    return null
  }
}

async function forwardGeocodeDirect(query: string): Promise<ForwardGeocodeResult | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'cz')
    url.searchParams.set('accept-language', 'cs')

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'cs',
        Accept: 'application/json',
      },
    })

    if (!response.ok) return null

    const data = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
    const hit = data[0]
    if (!hit?.lat || !hit.lon) return null

    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    return {
      lat,
      lng,
      display_name: hit.display_name?.trim() || query,
    }
  } catch {
    return null
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedAddress> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('format', 'json')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('accept-language', 'cs')

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'cs',
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return geocodeFallbackAddress(lat, lng)
    }

    const data = (await response.json()) as {
      display_name?: string
      address?: NominatimAddress
    }

    if (!data.display_name?.trim()) {
      return geocodeFallbackAddress(lat, lng)
    }

    const address = data.address ?? {}
    const streetParts = [address.road, address.house_number].filter(Boolean)
    const city = address.city ?? address.town ?? address.village ?? address.municipality ?? ''
    const localityParts = [city, address.county, address.state].filter(Boolean)

    return {
      address_full: data.display_name,
      street: streetParts.join(' '),
      city: localityParts.join(', '),
      postal_code: address.postcode ?? '',
      country: address.country ?? '',
    }
  } catch {
    return geocodeFallbackAddress(lat, lng)
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
    }, GPS_CAPTURE_MAX_WAIT_MS)

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
        timeout: GPS_CAPTURE_MAX_WAIT_MS,
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

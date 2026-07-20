import exifr from 'exifr'
import { FDG_GPS_LOAD_TIMEOUT_MS } from '@/constants/fotodokumentaceGps'
import { reverseGeocode } from '@/lib/photos/geocoding'
import type { FdgLocationDraft } from '@/types/fotodokumentaceGps'

export const EMPTY_LOCATION: FdgLocationDraft = {
  lat: null,
  lng: null,
  accuracy: null,
  address_full: '',
  street: '',
  city: '',
  postal_code: '',
  district: '',
  region: '',
  country: '',
  gpsVerified: false,
  loading: false,
  error: null,
}

/** Načte GPS do ~6 s – vezme nejlepší dostupnou přesnost. */
export function loadPhotoGps(onProgress?: (accuracy: number | null) => void): Promise<{
  lat: number
  lng: number
  accuracy: number
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS není v prohlížeči dostupné.'))
      return
    }

    let best: GeolocationPosition | null = null
    let watchId: number | null = null

    const cleanup = () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      clearTimeout(timeoutId)
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      if (best) {
        resolve({
          lat: best.coords.latitude,
          lng: best.coords.longitude,
          accuracy: best.coords.accuracy,
        })
        return
      }
      reject(new Error('Polohu se nepodařilo získat v časovém limitu.'))
    }, FDG_GPS_LOAD_TIMEOUT_MS)

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!best || position.coords.accuracy < best.coords.accuracy) {
          best = position
        }
        onProgress?.(position.coords.accuracy)
      },
      (error) => {
        cleanup()
        reject(new Error(error.message || 'Polohu se nepodařilo získat.'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: FDG_GPS_LOAD_TIMEOUT_MS }
    )
  })
}

export async function readExifGpsFromFile(file: File): Promise<{ lat: number; lng: number } | null> {
  try {
    const gps = await exifr.gps(file)
    if (!gps || typeof gps.latitude !== 'number' || typeof gps.longitude !== 'number') return null
    return { lat: gps.latitude, lng: gps.longitude }
  } catch {
    return null
  }
}

export async function loadPhotoLocationFromCoords(
  lat: number,
  lng: number,
  accuracy: number | null = null
): Promise<FdgLocationDraft> {
  try {
    const address = await reverseGeocode(lat, lng)
    return {
      lat,
      lng,
      accuracy,
      address_full: address.address_full,
      street: address.street,
      city: address.city,
      postal_code: address.postal_code,
      district: address.district ?? '',
      region: address.region ?? '',
      country: address.country,
      gpsVerified: true,
      loading: false,
      error: null,
    }
  } catch (err) {
    return {
      lat,
      lng,
      accuracy,
      address_full: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      street: '',
      city: '',
      postal_code: '',
      district: '',
      region: '',
      country: '',
      gpsVerified: true,
      loading: false,
      error: err instanceof Error ? err.message : 'Adresu se nepodařilo načíst.',
    }
  }
}

/** Načte GPS z EXIF nebo zařízení, poté adresu. */
export async function loadPhotoLocation(
  onProgress?: (accuracy: number | null) => void,
  exifCoords?: { lat: number; lng: number } | null
): Promise<FdgLocationDraft> {
  if (exifCoords) {
    return loadPhotoLocationFromCoords(exifCoords.lat, exifCoords.lng, null)
  }

  try {
    const gps = await loadPhotoGps(onProgress)
    const address = await reverseGeocode(gps.lat, gps.lng)
    return {
      lat: gps.lat,
      lng: gps.lng,
      accuracy: gps.accuracy,
      address_full: address.address_full,
      street: address.street,
      city: address.city,
      postal_code: address.postal_code,
      district: address.district ?? '',
      region: address.region ?? '',
      country: address.country,
      gpsVerified: true,
      loading: false,
      error: null,
    }
  } catch (err) {
    return {
      ...EMPTY_LOCATION,
      error: err instanceof Error ? err.message : 'GPS se nepodařilo načíst.',
    }
  }
}

export async function createThumbnail(file: File, maxSize = 320): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Miniaturu se nepodařilo vytvořit.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Miniaturu se nepodařilo vytvořit.'))),
      'image/jpeg',
      0.82
    )
  })
}

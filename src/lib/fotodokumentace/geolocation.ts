import { reverseGeocode } from '@/lib/photos/geocoding'
import type { FotoAdresa, FotoPoloha } from '@/types/fotodokumentace'

export const FOTO_GPS_TIMEOUT_MS = 6000

export interface FotoGpsVysledek {
  poloha: FotoPoloha | null
  adresa: FotoAdresa | null
  chyba: string | null
}

function prazdnaAdresa(): FotoAdresa {
  return {
    address_full: '',
    street: '',
    city: '',
    postal_code: '',
    district: '',
    region: '',
    country: '',
  }
}

function mapGeocoded(result: Awaited<ReturnType<typeof reverseGeocode>>): FotoAdresa {
  return {
    address_full: result.address_full,
    street: result.street,
    city: result.city,
    postal_code: result.postal_code,
    district: '',
    region: '',
    country: result.country,
  }
}

export function nacistPolohuPoFoto(onProgress?: (accuracy: number | null) => void): Promise<FotoPoloha> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS není v prohlížeči dostupné.'))
      return
    }

    let best: GeolocationPosition | null = null
    let watchId: number | null = null

    const finish = (pos: GeolocationPosition) => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      clearTimeout(timeoutId)
      resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        capturedAt: new Date(pos.timestamp),
      })
    }

    const timeoutId = setTimeout(() => {
      if (best) finish(best)
      else reject(new Error('Polohu se nepodařilo získat včas. Zkuste to znovu.'))
    }, FOTO_GPS_TIMEOUT_MS)

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos
        onProgress?.(pos.coords.accuracy)
        if (pos.coords.accuracy <= 15) finish(pos)
      },
      (err) => {
        if (watchId != null) navigator.geolocation.clearWatch(watchId)
        clearTimeout(timeoutId)
        reject(new Error(err.message || 'Polohu se nepodařilo získat.'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: FOTO_GPS_TIMEOUT_MS }
    )
  })
}

export async function nacistAdresuZPolohy(lat: number, lng: number): Promise<FotoAdresa> {
  const result = await reverseGeocode(lat, lng)
  return mapGeocoded(result)
}

export async function nacistPolohuAAdresu(
  onGpsProgress?: (accuracy: number | null) => void
): Promise<FotoGpsVysledek> {
  try {
    const poloha = await nacistPolohuPoFoto(onGpsProgress)
    try {
      const adresa = await nacistAdresuZPolohy(poloha.lat, poloha.lng)
      return { poloha, adresa, chyba: null }
    } catch {
      return {
        poloha,
        adresa: {
          ...prazdnaAdresa(),
          address_full: `${poloha.lat.toFixed(6)}, ${poloha.lng.toFixed(6)}`,
        },
        chyba: null,
      }
    }
  } catch (err) {
    return {
      poloha: null,
      adresa: null,
      chyba: err instanceof Error ? err.message : 'GPS selhalo.',
    }
  }
}

export async function vytvoritMiniaturu(file: File, maxSize = 320): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas není dostupný.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.75)
  )
  if (!blob) throw new Error('Miniaturu se nepodařilo vytvořit.')
  return new File([blob], `thumb_${file.name}`, { type: 'image/jpeg' })
}

export async function readExifFromFile(file: File): Promise<{ lat?: number; lng?: number; capturedAt?: Date }> {
  // Základní EXIF bez externí knihovny – pokus o načtení z názvu souboru / lastModified
  return { capturedAt: new Date(file.lastModified) }
}

import { reverseGeocode } from '@/lib/photos/geocoding'
import type { FotoAdresa, FotoPoloha } from '@/types/fotodokumentace'

/** Cílová přesnost pro fotodokumentaci (metry) – specifikace ±2–3 m */
export const FOTO_GPS_TARGET_METERS = 3

/** Maximální přesnost pro automatické přijetí po timeoutu (metry) */
export const FOTO_GPS_ACCEPTABLE_METERS = 10

/** Maximální čekání na GPS (ms) – součást 10s budgetu celého flow */
export const FOTO_GPS_TIMEOUT_MS = 8_000

/** Po tomto čase zobrazíme upozornění na nízkou přesnost */
export const FOTO_GPS_WARN_MS = 4_000

/** Celkový časový budget focení + ukládání (ms) */
export const FOTO_FLOW_BUDGET_MS = 10_000

export interface FotoGpsVysledek {
  poloha: FotoPoloha | null
  adresa: FotoAdresa | null
  chyba: string | null
  /** Přesnost dosažena (≤ cíl) */
  presnostOk: boolean
}

interface PredbezneGps {
  promise: Promise<{ poloha: FotoPoloha; presnostOk: boolean }> | null
  startedAt: number | null
}

const predbezneGps: PredbezneGps = { promise: null, startedAt: null }

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

/** Spustí GPS už při náhledu fotky – ušetří 2–4 s při ukládání. */
export function spustitPredbezneGps(
  onProgress?: (accuracy: number | null) => void
): void {
  if (predbezneGps.promise) return
  predbezneGps.startedAt = Date.now()
  predbezneGps.promise = nacistPolohuPoFoto(onProgress)
}

export function resetPredbezneGps(): void {
  predbezneGps.promise = null
  predbezneGps.startedAt = null
}

export function getPredbezneGpsPromise():
  | Promise<{ poloha: FotoPoloha; presnostOk: boolean }>
  | null {
  return predbezneGps.promise
}

export function nacistPolohuPoFoto(
  onProgress?: (accuracy: number | null) => void
): Promise<{ poloha: FotoPoloha; presnostOk: boolean }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS není v prohlížeči dostupné.'))
      return
    }

    let best: GeolocationPosition | null = null
    let watchId: number | null = null
    let finished = false

    const finish = (pos: GeolocationPosition, presnostOk: boolean) => {
      if (finished) return
      finished = true
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      clearTimeout(timeoutId)
      clearTimeout(warnId)
      resolve({
        poloha: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date(pos.timestamp),
        },
        presnostOk,
      })
    }

    const fail = (message: string) => {
      if (finished) return
      finished = true
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      clearTimeout(timeoutId)
      clearTimeout(warnId)
      reject(new Error(message))
    }

    const timeoutId = setTimeout(() => {
      if (best) {
        const acc = best.coords.accuracy
        finish(best, acc <= FOTO_GPS_TARGET_METERS)
      } else {
        fail('Polohu se nepodařilo získat. Povolte GPS v prohlížeči a v nastavení telefonu.')
      }
    }, FOTO_GPS_TIMEOUT_MS)

    const warnId = setTimeout(() => {
      onProgress?.(best?.coords.accuracy ?? null)
    }, FOTO_GPS_WARN_MS)

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) {
          best = pos
        }
        onProgress?.(pos.coords.accuracy)

        if (pos.coords.accuracy <= FOTO_GPS_TARGET_METERS) {
          finish(pos, true)
        }
      },
      (err) => fail(err.message || 'Polohu se nepodařilo získat.'),
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
    const prefetched = getPredbezneGpsPromise()
    const { poloha, presnostOk } = prefetched
      ? await prefetched
      : await nacistPolohuPoFoto(onGpsProgress)

    resetPredbezneGps()

    try {
      const adresa = await nacistAdresuZPolohy(poloha.lat, poloha.lng)
      return { poloha, adresa, chyba: null, presnostOk }
    } catch {
      return {
        poloha,
        adresa: {
          ...prazdnaAdresa(),
          address_full: `${poloha.lat.toFixed(6)}, ${poloha.lng.toFixed(6)}`,
        },
        chyba: null,
        presnostOk,
      }
    }
  } catch (err) {
    resetPredbezneGps()
    return {
      poloha: null,
      adresa: null,
      chyba: err instanceof Error ? err.message : 'GPS selhalo.',
      presnostOk: false,
    }
  }
}

export async function vytvoritMiniaturu(file: File, maxSize = 320): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.75)
    )
    if (!blob) return null
    return new File([blob], `thumb_${file.name}`, { type: 'image/jpeg' })
  } catch {
    return null
  }
}

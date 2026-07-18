import type { GpsPhoto } from '@/types/photos'
import { parseDateParts } from '@/lib/dates'

export const ADDRESS_GEOCODE_FAILED = 'Adresa se nepodařila načíst, souřadnice jsou uloženy.'
export const ADDRESS_LOADING_LABEL = 'Adresa se načítá'
export const ADDRESS_UNAVAILABLE_LABEL = 'Adresa nedostupná'

export function formatGpsCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function formatGpsCoordinatesCompact(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function isLikelyCoordinateAddress(value: string): boolean {
  return /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(value.trim())
}

export function formatPhotoAddress(
  photo: Pick<GpsPhoto, 'address_full' | 'gps_lat' | 'gps_lng' | 'street' | 'city' | 'postal_code'>
): string {
  const addr = photo.address_full?.trim()
  if (addr && !isLikelyCoordinateAddress(addr)) {
    return addr
  }
  const street = photo.street?.trim()
  const city = photo.city?.trim()
  const postal = photo.postal_code?.trim()
  if (street || city) {
    const cityPart = [city, postal ? `(${postal})` : ''].filter(Boolean).join(' ')
    return [street, cityPart].filter(Boolean).join(', ')
  }
  return ADDRESS_GEOCODE_FAILED
}

/** Dvě adresy: geokódovaná (reverse geocoding) a strukturovaná (ulice, obec, PSČ). */
export function getPhotoAddressDetails(
  photo: Pick<GpsPhoto, 'address_full' | 'street' | 'city' | 'postal_code' | 'country' | 'gps_lat' | 'gps_lng'>
): { geocoded: string; structured: string } {
  const rawFull = photo.address_full?.trim() ?? ''
  const geocoded =
    rawFull && !isLikelyCoordinateAddress(rawFull) ? rawFull : formatPhotoAddress(photo)

  const structuredParts = [
    photo.street?.trim(),
    [photo.postal_code?.trim(), photo.city?.trim()].filter(Boolean).join(' '),
    photo.country?.trim() && photo.country !== 'CZ' ? photo.country.trim() : '',
  ].filter(Boolean)
  const structured = structuredParts.join(', ')

  if (!structured || structured === geocoded) {
    return { geocoded, structured: '' }
  }
  return { geocoded, structured }
}

export function formatGpsLocationLabel(lat: number, lng: number, accuracy?: number | null): string {
  const base = formatGpsCoordinatesCompact(lat, lng)
  if (accuracy != null && accuracy > 0) {
    return `${base} (±${Math.round(accuracy)} m)`
  }
  return base
}

export function formatCaptureWeekday(dateIso: string): string {
  const parts = parseDateParts(dateIso)
  if (!parts) return ''
  const date = new Date(parts.year, parts.month - 1, parts.day)
  return date.toLocaleDateString('cs-CZ', { weekday: 'long' }).toUpperCase()
}

export function formatCaptureDateLabel(dateIso: string): string {
  const parts = parseDateParts(dateIso)
  if (!parts) return dateIso
  const date = new Date(parts.year, parts.month - 1, parts.day)
  return date.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
}

export function formatCaptureTime(time: string): string {
  if (!time) return '—'
  const parts = time.split(':')
  if (parts.length >= 3) return `${parts[0]}:${parts[1]}:${parts[2]}`
  return time.slice(0, 5)
}

export function getOrderDisplayName(photo: GpsPhoto): string {
  return photo.order_name?.trim() || 'OBECNÉ STAVENIŠTĚ'
}

export function geocodeFallbackAddress(lat?: number, lng?: number) {
  void lat
  void lng
  return {
    address_full: ADDRESS_UNAVAILABLE_LABEL,
    street: '',
    city: '',
    postal_code: '',
    country: '',
  }
}

import type { GpsPhoto } from '@/types/photos'

export const ADDRESS_GEOCODE_FAILED = 'Adresa se nepodařila načíst, souřadnice jsou uloženy.'

export function formatGpsCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

export function isLikelyCoordinateAddress(value: string): boolean {
  return /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(value.trim())
}

export function formatPhotoAddress(
  photo: Pick<GpsPhoto, 'address_full' | 'gps_lat' | 'gps_lng'>
): string {
  const addr = photo.address_full?.trim()
  if (!addr || isLikelyCoordinateAddress(addr)) {
    return ADDRESS_GEOCODE_FAILED
  }
  return addr
}

export function geocodeFallbackAddress(_lat: number, _lng: number) {
  return {
    address_full: ADDRESS_GEOCODE_FAILED,
    street: '',
    city: '',
    postal_code: '',
    country: '',
  }
}

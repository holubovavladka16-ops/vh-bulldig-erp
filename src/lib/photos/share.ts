import { formatDate } from '@/constants/workers'
import {
  formatCaptureTime,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
  getOrderDisplayName,
} from '@/lib/photos/photoDisplay'
import { getGoogleMapsUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'
import type { GpsPhoto } from '@/types/photos'

export type SharePhotoInfoResult = 'shared' | 'cancelled' | 'unsupported'

export function buildPhotoShareText(photo: GpsPhoto): string {
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const streetViewUrl = getStreetViewUrl(photo.gps_lat, photo.gps_lng)
  const orderName = getOrderDisplayName(photo)
  const address = formatPhotoAddress(photo)
  const coords = formatGpsCoordinatesCompact(photo.gps_lat, photo.gps_lng)

  return [
    `Fotodokumentace VH Bulldig – ${orderName}`,
    '',
    `Datum: ${formatDate(photo.captured_date)}`,
    `Čas: ${formatCaptureTime(photo.captured_time)}`,
    `GPS: ${coords}`,
    photo.gps_accuracy != null ? `Přesnost: ±${Math.round(photo.gps_accuracy)} m` : '',
    `Adresa: ${address}`,
    photo.note?.trim() ? `Popis prací: ${photo.note.trim()}` : '',
    '',
    `Mapa: ${mapUrl}`,
    `Street View: ${streetViewUrl}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildPhotoShareTitle(photo: GpsPhoto): string {
  return `Fotodokumentace – ${getOrderDisplayName(photo)}`
}

/** Textové sdílení GPS informací – navigator.share({ title, text, url }). */
export async function sharePhotoInfo(photo: GpsPhoto): Promise<SharePhotoInfoResult> {
  const text = buildPhotoShareText(photo)
  const title = buildPhotoShareTitle(photo)
  const url = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)

  if (typeof navigator.share !== 'function') {
    if (typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(`${text}\n\n${url}`)
        return 'shared'
      } catch {
        return 'unsupported'
      }
    }
    return 'unsupported'
  }

  try {
    await navigator.share({ title, text, url })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}

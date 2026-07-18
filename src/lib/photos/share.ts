import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
  getOrderDisplayName,
} from '@/lib/photos/photoDisplay'
import { fetchGpsPhotoBlob } from '@/lib/photos/api'
import { getGoogleMapsUrl } from '@/lib/photos/mapLinks'
import type { GpsPhoto } from '@/types/photos'

export type PhotoShareResult = 'shared' | 'shared_text_only' | 'unsupported' | 'cancelled'

export function buildPhotoShareText(photo: GpsPhoto): string {
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const orderName = getOrderDisplayName(photo)
  const address = formatPhotoAddress(photo)
  const dateLabel = formatCaptureDateLabel(photo.captured_date)
  const timeLabel = formatCaptureTime(photo.captured_time)
  const coords = formatGpsCoordinatesCompact(photo.gps_lat, photo.gps_lng)

  return [
    'Fotodokumentace VH Bulldig',
    '',
    `Zakázka: ${orderName}`,
    `Datum a čas: ${dateLabel} ${timeLabel}`,
    `GPS: ${coords}`,
    photo.gps_accuracy != null ? `Přesnost: ±${Math.round(photo.gps_accuracy)} m` : '',
    `Adresa: ${address}`,
    photo.note?.trim() ? `Poznámka: ${photo.note.trim()}` : '',
    '',
    `Google Maps: ${mapUrl}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export function buildPhotoShareTitle(photo: GpsPhoto): string {
  return `Fotodokumentace – ${getOrderDisplayName(photo)}`
}

export async function fetchGpsPhotoFile(photo: GpsPhoto): Promise<File> {
  const blob = await fetchGpsPhotoBlob(photo.file_path)
  const mime = blob.type.startsWith('image/') ? blob.type : 'image/jpeg'
  const safeName =
    photo.file_name?.trim() ||
    `fotodokumentace-${photo.captured_date}-${photo.captured_time.slice(0, 5).replace(':', '')}.jpg`
  return new File([blob], safeName, { type: mime, lastModified: Date.now() })
}

export function isWebShareAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export function canSharePhotoFile(file: File, text: string, title: string): boolean {
  if (!isWebShareAvailable() || typeof navigator.canShare !== 'function') return false
  return navigator.canShare({ files: [file], text, title })
}

/** Sdílení originální fotografie + metadata (Web Share API Level 2 s files). */
export async function shareGpsPhoto(photo: GpsPhoto): Promise<PhotoShareResult> {
  if (!isWebShareAvailable()) return 'unsupported'

  const file = await fetchGpsPhotoFile(photo)
  const text = buildPhotoShareText(photo)
  const title = buildPhotoShareTitle(photo)
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)

  const filePayload: ShareData = { title, text, files: [file] }
  if (canSharePhotoFile(file, text, title)) {
    try {
      await navigator.share(filePayload)
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  try {
    await navigator.share({ title, text, url: mapUrl })
    return 'shared_text_only'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}

export async function copyPhotoShareText(photo: GpsPhoto): Promise<void> {
  if (typeof navigator.clipboard?.writeText !== 'function') {
    throw new Error('Kopírování do schránky není v tomto prohlížeči dostupné.')
  }
  await navigator.clipboard.writeText(buildPhotoShareText(photo))
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function getMessengerShareUrl(text: string, mapUrl: string): string {
  const redirect = encodeURIComponent(window.location.href)
  return `https://www.facebook.com/dialog/send?link=${encodeURIComponent(mapUrl)}&app_id=0&redirect_uri=${redirect}&quote=${encodeURIComponent(text)}`
}

export function getEmailShareUrl(text: string, subject = 'Fotodokumentace VH Bulldig'): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}

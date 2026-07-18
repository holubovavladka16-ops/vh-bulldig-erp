import { formatDate } from '@/constants/workers'
import { getPublicAppUrl } from '@/lib/env'
import { getGoogleMapsUrl } from '@/lib/photos/mapLinks'
import { formatCaptureTime, formatPhotoShareAddress, getOrderDisplayName, getPhotoAuthorName } from '@/lib/photos/photoDisplay'
import type { GpsPhoto } from '@/types/photos'

export function getPhotoShareUrl(photoId: string): string {
  const base = getPublicAppUrl()
  return `${base}/sdileni/fotografie/${encodeURIComponent(photoId)}`
}

export function buildPhotoShareText(photo: GpsPhoto): string {
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const orderName = getOrderDisplayName(photo)
  const address = formatPhotoShareAddress(photo)
  const author = getPhotoAuthorName(photo)
  const shareUrl = getPhotoShareUrl(photo.id)

  return [
    `Fotodokumentace VH Bulldig – ${orderName}`,
    '',
    `Datum: ${formatDate(photo.captured_date)}`,
    `Čas: ${formatCaptureTime(photo.captured_time)}`,
    `GPS: ${photo.gps_lat.toFixed(5)}, ${photo.gps_lng.toFixed(5)}`,
    photo.gps_accuracy != null ? `Přesnost: ±${Math.round(photo.gps_accuracy)} m` : '',
    `Adresa: ${address}`,
    `Zakázka: ${orderName}`,
    photo.note?.trim() ? `Poznámka: ${photo.note.trim()}` : '',
    `Autor fotografie: ${author}`,
    '',
    `Mapa: ${mapUrl}`,
    `Odkaz na fotografii: ${shareUrl}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function getEmailShareUrl(text: string, subject = 'Fotodokumentace VH Bulldig'): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}

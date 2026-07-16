import { formatDate } from '@/constants/workers'

import { getGoogleMapsUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'

import type { GpsPhoto } from '@/types/photos'



export function buildPhotoShareText(photo: GpsPhoto): string {
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const streetViewUrl = getStreetViewUrl(photo.gps_lat, photo.gps_lng)
  const orderName = photo.order_name?.trim() || 'Obecné staveniště'

  return [
    `Fotodokumentace VH Bulldig – ${orderName}`,
    '',
    `Datum: ${formatDate(photo.captured_date)}`,
    `Čas: ${photo.captured_time.slice(0, 8)}`,
    `GPS: ${photo.gps_lat.toFixed(5)}, ${photo.gps_lng.toFixed(5)}`,
    photo.gps_accuracy != null ? `Přesnost: ±${Math.round(photo.gps_accuracy)} m` : '',
    `Adresa: ${photo.address_full || '—'}`,
    photo.note ? `Popis prací: ${photo.note}` : '',
    '',
    `Mapa: ${mapUrl}`,
    `Street View: ${streetViewUrl}`,
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


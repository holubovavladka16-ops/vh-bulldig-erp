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

/** Text pro sdílení hned po vyfocení (před uložením do galerie). */
export function buildSnapshotShareText(input: {
  lat: number
  lng: number
  accuracy: number | null
  addressFull: string
  capturedAt: Date
  note: string
  orderName: string
}): string {
  const date = input.capturedAt.toISOString().slice(0, 10)
  const time = input.capturedAt.toTimeString().slice(0, 8)
  return buildPhotoShareText({
    id: 'preview',
    file_path: '',
    file_name: '',
    captured_at: input.capturedAt.toISOString(),
    captured_date: date,
    captured_time: time,
    gps_lat: input.lat,
    gps_lng: input.lng,
    gps_accuracy: input.accuracy,
    device_heading: null,
    address_full: input.addressFull,
    street: '',
    city: '',
    postal_code: '',
    country: 'CZ',
    note: input.note || null,
    order_id: null,
    worker_id: null,
    report_id: null,
    diary_entry_id: null,
    utility_connection_id: null,
    photo_phase: null,
    construction_point_id: null,
    sort_order: 0,
    order_name: input.orderName,
    created_by: null,
    created_at: input.capturedAt.toISOString(),
    updated_at: input.capturedAt.toISOString(),
  })
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


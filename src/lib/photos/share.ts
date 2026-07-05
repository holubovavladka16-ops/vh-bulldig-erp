import { formatDate, formatTime } from '@/constants/workers'

import { getGoogleMapsUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'

import type { GpsPhoto } from '@/types/photos'



export function buildPhotoShareText(photo: GpsPhoto): string {

  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)

  const streetViewUrl = getStreetViewUrl(photo.gps_lat, photo.gps_lng)



  return [

    'Fotodokumentace VH Bulldig',

    '',

    `Datum pořízení: ${formatDate(photo.captured_date)}`,

    `Čas pořízení: ${formatTime(photo.captured_time)}`,

    `GPS: ${photo.gps_lat.toFixed(6)}, ${photo.gps_lng.toFixed(6)}`,

    `Adresa: ${photo.address_full}`,

    photo.street ? `Ulice: ${photo.street}` : '',

    photo.city ? `Město: ${photo.city}` : '',

    photo.postal_code ? `PSČ: ${photo.postal_code}` : '',

    photo.country ? `Stát: ${photo.country}` : '',

    photo.note ? `Poznámka: ${photo.note}` : '',

    '',

    `Mapa: ${mapUrl}`,

    `Pohled z ulice: ${streetViewUrl}`,

  ]

    .filter(Boolean)

    .join('\n')

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


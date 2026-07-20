import { createGpsFotodokladPdfFile } from '@/lib/fotodokumentace-gps/gpsFotodokladPdf'
import {
  getGoogleMapsUrl,
  getMapyCzUrl,
  getStreetViewUrl,
} from '@/lib/photos/mapLinks'
import { formatCaptureDateLabel, formatPhotoAddress, getOrderDisplayName } from '@/lib/photos/photoDisplay'
import type { CompanySettings } from '@/types'
import type { GpsPhoto } from '@/types/photos'

function formatShareText(photo: GpsPhoto): string {
  const lines = [
    `Zakázka: ${getOrderDisplayName(photo)}`,
    `Datum: ${formatCaptureDateLabel(photo.captured_date)} ${photo.captured_time}`,
    `Adresa: ${formatPhotoAddress(photo)}`,
  ]
  if (photo.gps_lat != null && photo.gps_lng != null) {
    lines.push(`GPS: ${photo.gps_lat.toFixed(5)}, ${photo.gps_lng.toFixed(5)}`)
    lines.push(`Mapy.cz: ${getMapyCzUrl(photo.gps_lat, photo.gps_lng)}`)
    lines.push(`Google Maps: ${getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)}`)
  }
  if (photo.note?.trim()) lines.push(`Poznámka: ${photo.note.trim()}`)
  return lines.join('\n')
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function getMessengerShareUrl(text: string): string {
  const redirect = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')
  return `https://www.facebook.com/dialog/send?redirect_uri=${redirect}&quote=${encodeURIComponent(text)}`
}

export function getEmailShareUrl(subject: string, text: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}

async function sharePdfFile(
  photo: GpsPhoto,
  company?: CompanySettings | null,
  title = 'GPS fotodoklad'
): Promise<boolean> {
  const file = await createGpsFotodokladPdfFile([photo], company)
  const text = formatShareText(photo)
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title, text })
    return true
  }
  return false
}

export async function sharePhotoPdf(
  photo: GpsPhoto,
  company?: CompanySettings | null
): Promise<boolean> {
  const text = formatShareText(photo)
  try {
    if (await sharePdfFile(photo, company)) return true
    if (navigator.share) {
      await navigator.share({ title: 'GPS fotodoklad', text })
      return true
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return false
  }
  const file = await createGpsFotodokladPdfFile([photo], company)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  URL.revokeObjectURL(a.href)
  return true
}

export async function openWhatsAppShare(
  photo: GpsPhoto,
  company?: CompanySettings | null
): Promise<void> {
  try {
    if (await sharePdfFile(photo, company, 'GPS fotodoklad – WhatsApp')) return
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
  }
  window.open(getWhatsAppShareUrl(formatShareText(photo)), '_blank')
}

export async function openMessengerShare(
  photo: GpsPhoto,
  company?: CompanySettings | null
): Promise<void> {
  try {
    if (await sharePdfFile(photo, company, 'GPS fotodoklad – Messenger')) return
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
  }
  window.open(getMessengerShareUrl(formatShareText(photo)), '_blank')
}

export async function openEmailShare(
  photo: GpsPhoto,
  company?: CompanySettings | null
): Promise<void> {
  try {
    if (await sharePdfFile(photo, company, 'GPS fotodoklad – e-mail')) return
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
  }
  const subject = `GPS fotodoklad – ${getOrderDisplayName(photo)}`
  window.location.href = getEmailShareUrl(subject, formatShareText(photo))
}

export function getPhotoMapLinks(photo: GpsPhoto): { mapy: string; google: string; street: string } | null {
  if (photo.gps_lat == null || photo.gps_lng == null) return null
  return {
    mapy: getMapyCzUrl(photo.gps_lat, photo.gps_lng),
    google: getGoogleMapsUrl(photo.gps_lat, photo.gps_lng),
    street: getStreetViewUrl(photo.gps_lat, photo.gps_lng),
  }
}

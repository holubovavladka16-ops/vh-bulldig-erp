import { fetchGpsPhotoBlob } from '@/lib/photos/api'
import {
  buildGpsPhotoShareFileName,
  buildGpsPhotoShareImageFile,
} from '@/lib/photos/photoShareImage'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
  getOrderDisplayName,
} from '@/lib/photos/photoDisplay'
import { getGoogleMapsUrl } from '@/lib/photos/mapLinks'
import type { GpsPhoto } from '@/types/photos'

export type PhotoShareMode = 'document' | 'original'

export type PhotoShareChannel = 'whatsapp' | 'messenger' | 'email' | 'other' | 'save'

export type PhotoShareChannelResult = 'shared' | 'downloaded' | 'cancelled' | 'unsupported'

const DEFAULT_ORDER_LABEL = 'OBECNÉ STAVENIŠTĚ'

export function hasPhotoOrderName(photo: GpsPhoto): boolean {
  if (photo.order_id) return true
  const name = photo.order_name?.trim()
  return Boolean(name && name.toUpperCase() !== DEFAULT_ORDER_LABEL)
}

/** Text pro e-mail / náhled – metadata jsou primárně v obraze. */
export function buildPhotoShareText(photo: GpsPhoto): string {
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const address = formatPhotoAddress(photo)
  const dateLabel = formatCaptureDateLabel(photo.captured_date)
  const timeLabel = formatCaptureTime(photo.captured_time)
  const coords = formatGpsCoordinatesCompact(photo.gps_lat, photo.gps_lng)

  const lines = [`📍 ${address}`, `🌍 ${coords}`, `🕒 ${dateLabel}, ${timeLabel}`]

  if (hasPhotoOrderName(photo)) {
    lines.push(`🏗️ ${getOrderDisplayName(photo)}`)
  }

  lines.push(`🔗 ${mapUrl}`)

  const note = photo.note?.trim()
  if (note) lines.push('', note)

  return lines.join('\n')
}

export function buildPhotoShareTitle(photo: GpsPhoto): string {
  return hasPhotoOrderName(photo)
    ? `GPS fotodoklad – ${getOrderDisplayName(photo)}`
    : 'GPS fotodoklad VH Bulldig'
}

export async function fetchGpsPhotoFile(photo: GpsPhoto): Promise<File> {
  const blob = await fetchGpsPhotoBlob(photo.file_path)
  const mime = blob.type.startsWith('image/') ? blob.type : 'image/jpeg'
  const safeName =
    photo.file_name?.trim() ||
    `fotografie-${photo.captured_date}-${photo.captured_time.slice(0, 5).replace(':', '')}.jpg`
  return new File([blob], safeName, { type: mime, lastModified: Date.now() })
}

export async function resolvePhotoShareFile(
  photo: GpsPhoto,
  mode: PhotoShareMode
): Promise<File> {
  if (mode === 'original') return fetchGpsPhotoFile(photo)
  return buildGpsPhotoShareImageFile(photo)
}

export function isWebShareAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export function canSharePhotoFile(file: File): boolean {
  if (!isWebShareAvailable() || typeof navigator.canShare !== 'function') return false
  return navigator.canShare({ files: [file] })
}

export function downloadShareFile(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  window.setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link)
    URL.revokeObjectURL(url)
  }, 1500)
}

export async function sharePhotoFileNative(file: File, title: string): Promise<PhotoShareChannelResult> {
  if (!canSharePhotoFile(file)) return 'unsupported'

  try {
    await navigator.share({
      files: [file],
      title,
    })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}

export async function sharePhotoViaChannel(
  file: File,
  photo: GpsPhoto,
  channel: PhotoShareChannel
): Promise<PhotoShareChannelResult> {
  const title = buildPhotoShareTitle(photo)

  if (channel === 'save') {
    downloadShareFile(file)
    return 'downloaded'
  }

  const nativeResult = await sharePhotoFileNative(file, title)
  if (nativeResult === 'shared' || nativeResult === 'cancelled') return nativeResult

  if (channel === 'email') {
    const body = `${buildPhotoShareText(photo)}\n\n(GPS fotodoklad je v příloze obrázku – ${file.name})`
    window.location.href = getEmailShareUrl(body, title)
    downloadShareFile(file)
    return 'downloaded'
  }

  downloadShareFile(file)
  return 'downloaded'
}

export function getWhatsAppShareUrl(_text: string): string {
  return 'https://wa.me/'
}

export function getMessengerShareUrl(text: string, mapUrl: string): string {
  const redirect = encodeURIComponent(window.location.href)
  return `https://www.facebook.com/dialog/send?link=${encodeURIComponent(mapUrl)}&app_id=0&redirect_uri=${redirect}&quote=${encodeURIComponent(text)}`
}

export function getEmailShareUrl(text: string, subject = 'GPS fotodokumentace VH Bulldig'): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}

export function getShareChannelLogName(channel: PhotoShareChannel, mode: PhotoShareMode): string {
  const prefix = mode === 'document' ? 'doklad' : 'original'
  return `${prefix}_${channel}`
}

export { buildGpsPhotoShareFileName }

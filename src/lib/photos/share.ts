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

export type PhotoShareResult =
  | 'shared'
  | 'shared_file_only'
  | 'shared_text_only'
  | 'unsupported'
  | 'cancelled'

const DEFAULT_ORDER_LABEL = 'OBECNÉ STAVENIŠTĚ'

export function hasPhotoOrderName(photo: GpsPhoto): boolean {
  if (photo.order_id) return true
  const name = photo.order_name?.trim()
  return Boolean(name && name.toUpperCase() !== DEFAULT_ORDER_LABEL)
}

/** Text pro sdílení – fotka nahoře, metadata pod ní (WhatsApp, Messenger, Gmail). */
export function buildPhotoShareText(photo: GpsPhoto): string {
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const address = formatPhotoAddress(photo)
  const dateLabel = formatCaptureDateLabel(photo.captured_date)
  const timeLabel = formatCaptureTime(photo.captured_time)
  const coords = formatGpsCoordinatesCompact(photo.gps_lat, photo.gps_lng)

  const lines = [`📍 ${address}`, `🌍 ${coords}`, `🕒 ${dateLabel} ${timeLabel}`]

  if (hasPhotoOrderName(photo)) {
    lines.push(`🏗️ ${getOrderDisplayName(photo)}`)
  }

  lines.push(`🔗 ${mapUrl}`)

  const note = photo.note?.trim()
  if (note) {
    lines.push('', note)
  }

  return lines.join('\n')
}

export function buildPhotoShareTitle(photo: GpsPhoto): string {
  return hasPhotoOrderName(photo)
    ? `Fotodokumentace – ${getOrderDisplayName(photo)}`
    : 'Fotodokumentace VH Bulldig'
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

export function canSharePhotoWithText(file: File, text: string, title: string): boolean {
  if (!isWebShareAvailable() || typeof navigator.canShare !== 'function') return false
  return navigator.canShare({ files: [file], text, title })
}

export function canSharePhotoFileOnly(file: File): boolean {
  if (!isWebShareAvailable() || typeof navigator.canShare !== 'function') return false
  return navigator.canShare({ files: [file] })
}

/**
 * Sdílení originální fotografie + metadata (Web Share API Level 2: files + text).
 * Pokud prohlížeč neumí soubor i text najednou, sdílí fotku a popis zkopíruje do schránky.
 */
export async function shareGpsPhoto(photo: GpsPhoto): Promise<PhotoShareResult> {
  if (!isWebShareAvailable()) return 'unsupported'

  const file = await fetchGpsPhotoFile(photo)
  const text = buildPhotoShareText(photo)
  const title = buildPhotoShareTitle(photo)

  if (canSharePhotoWithText(file, text, title)) {
    try {
      await navigator.share({ title, text, files: [file] })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  if (canSharePhotoFileOnly(file)) {
    try {
      await navigator.share({ title, files: [file] })
      try {
        await copyPhotoShareText(photo)
      } catch {
        // Schránka nemusí být dostupná – fotka je sdílená.
      }
      return 'shared_file_only'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  try {
    await navigator.share({ title, text, url: mapUrl })
    return 'shared_text_only'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}

/** Záložní sdílení bez Web Share API – stažení fotky + popis do schránky. */
export async function shareGpsPhotoFallbackDownload(
  photo: GpsPhoto,
  download: (filePath: string, fileName: string) => Promise<void>
): Promise<'downloaded' | 'failed'> {
  try {
    await download(photo.file_path, photo.file_name)
    try {
      await copyPhotoShareText(photo)
    } catch {
      // Stažení proběhlo, kopírování je volitelné.
    }
    return 'downloaded'
  } catch {
    return 'failed'
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

import { reverseGeocode } from '@/lib/photos/geocoding'
import { getGpsPhotoUrl, updateGpsPhotoAddress } from '@/lib/photos/api'
import {
  buildPhotoShareText,
  getEmailShareUrl,
  getPhotoShareUrl,
  getWhatsAppShareUrl,
} from '@/lib/photos/share'
import { shareWithFiles } from '@/lib/share/webShare'
import type { GpsPhoto } from '@/types/photos'
import { ADDRESS_GEOCODE_FAILED, ADDRESS_PENDING, formatPhotoShareAddress } from '@/lib/photos/photoDisplay'

export type PhotoShareChannel = 'whatsapp' | 'messenger' | 'email' | 'native'

export type PhotoShareOutcome = 'shared' | 'cancelled' | 'opened' | 'downloaded' | 'copied'

export interface PhotoShareResult {
  outcome: PhotoShareOutcome
  channel: PhotoShareChannel
}

function assertPhotoFile(photo: GpsPhoto): void {
  if (!photo.file_path?.trim()) {
    throw new Error('Fotografie nemá přiřazený soubor – sdílení není možné.')
  }
}

async function loadPhotoBlob(photo: GpsPhoto): Promise<Blob> {
  const response = await fetch(getGpsPhotoUrl(photo.file_path))
  if (!response.ok) {
    throw new Error('Načtení fotografie pro sdílení se nezdařilo.')
  }
  const blob = await response.blob()
  if (!blob.size) {
    throw new Error('Soubor fotografie je prázdný – sdílení není možné.')
  }
  return blob
}

function createPhotoFile(photo: GpsPhoto, blob: Blob): File {
  const safeName = photo.file_name?.trim() || `fotografie-${photo.id.slice(0, 8)}.jpg`
  const type = blob.type || 'image/jpeg'
  return new File([blob], safeName, { type })
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Nepodařilo se načíst obrázek fotografie.'))
    }
    img.src = url
  })
}

function wrapCanvasLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

export async function buildPhotoShareComposite(photo: GpsPhoto, photoBlob: Blob): Promise<Blob> {
  const img = await loadImageElement(photoBlob)
  const maxWidth = 1080
  const scale = Math.min(1, maxWidth / img.width)
  const photoWidth = Math.round(img.width * scale)
  const photoHeight = Math.round(img.height * scale)
  const panelPadding = 24
  const lineHeight = 26
  const infoLines = buildPhotoShareText(photo).split('\n').filter(Boolean)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas není dostupný.')

  ctx.font = '18px "Noto Sans", "Segoe UI", Arial, sans-serif'
  const wrappedLines = infoLines.flatMap((line) => wrapCanvasLine(ctx, line, photoWidth - panelPadding * 2))
  const panelHeight = panelPadding * 2 + wrappedLines.length * lineHeight + 12

  canvas.width = photoWidth
  canvas.height = photoHeight + panelHeight

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, photoWidth, photoHeight)

  ctx.fillStyle = '#1e3a5f'
  ctx.fillRect(0, photoHeight, photoWidth, panelHeight)
  ctx.fillStyle = '#ffffff'
  ctx.font = '18px "Noto Sans", "Segoe UI", Arial, sans-serif'

  let y = photoHeight + panelPadding + 18
  for (const line of wrappedLines) {
    ctx.fillText(line, panelPadding, y)
    y += lineHeight
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Vytvoření sdíleného obrázku se nezdařilo.'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      0.9
    )
  })
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function needsAddressLookup(photo: GpsPhoto): boolean {
  const shareAddress = formatPhotoShareAddress(photo)
  return shareAddress === ADDRESS_PENDING || shareAddress === ADDRESS_GEOCODE_FAILED
}

export async function ensurePhotoAddress(photo: GpsPhoto): Promise<GpsPhoto> {
  if (!needsAddressLookup(photo)) return photo

  try {
    const geocoded = await reverseGeocode(photo.gps_lat, photo.gps_lng)
    if (!geocoded.address_full?.trim()) return photo

    await updateGpsPhotoAddress(photo.id, geocoded)
    return {
      ...photo,
      address_full: geocoded.address_full,
      street: geocoded.street,
      city: geocoded.city,
      postal_code: geocoded.postal_code,
      country: geocoded.country,
    }
  } catch {
    return photo
  }
}

async function tryNativeShare(input: {
  title: string
  text: string
  url: string
  files: File[]
}): Promise<'shared' | 'cancelled' | null> {
  const result = await shareWithFiles(input)
  if (result === 'shared' || result === 'cancelled') return result
  return null
}

async function fallbackShare(
  channel: PhotoShareChannel,
  photo: GpsPhoto,
  text: string,
  shareUrl: string,
  photoFile: File,
  compositeFile: File
): Promise<PhotoShareOutcome> {
  downloadBlob(compositeFile, compositeFile.name)

  if (channel === 'email') {
    window.location.href = getEmailShareUrl(text, `Fotodokumentace VH Bulldig – ${photo.order_name?.trim() || 'zakázka'}`)
    return 'opened'
  }

  if (channel === 'whatsapp') {
    window.open(
      getWhatsAppShareUrl(
        `${text}\n\n(Fotografie byla stažena jako soubor „${compositeFile.name}" – přiložte ji ke zprávě.)`
      ),
      '_blank',
      'noopener,noreferrer'
    )
    return 'opened'
  }

  if (channel === 'messenger') {
    try {
      await navigator.clipboard.writeText(`${text}\n\n${shareUrl}`)
      return 'copied'
    } catch {
      return 'downloaded'
    }
  }

  if (channel === 'native') {
    try {
      await navigator.clipboard.writeText(`${text}\n\n${shareUrl}`)
      return 'copied'
    } catch {
      return 'downloaded'
    }
  }

  void photoFile
  return 'downloaded'
}

export async function shareGpsPhoto(photo: GpsPhoto, channel: PhotoShareChannel): Promise<PhotoShareResult> {
  assertPhotoFile(photo)

  const enrichedPhoto = await ensurePhotoAddress(photo)
  const text = buildPhotoShareText(enrichedPhoto)
  const shareUrl = getPhotoShareUrl(enrichedPhoto.id)
  const title = `Fotodokumentace VH Bulldig – ${enrichedPhoto.order_name?.trim() || 'zakázka'}`

  const photoBlob = await loadPhotoBlob(enrichedPhoto)
  const photoFile = createPhotoFile(enrichedPhoto, photoBlob)
  const compositeBlob = await buildPhotoShareComposite(enrichedPhoto, photoBlob)
  const compositeFile = new File(
    [compositeBlob],
    `fotodokumentace-${enrichedPhoto.id.slice(0, 8)}.jpg`,
    { type: 'image/jpeg' }
  )

  const sharePayload = {
    title,
    text: `${text}\n\nOdkaz na fotografii: ${shareUrl}`,
    url: shareUrl,
  }

  const nativeResult = await tryNativeShare({
    ...sharePayload,
    files: [photoFile],
  })
  if (nativeResult === 'shared') return { outcome: 'shared', channel }
  if (nativeResult === 'cancelled') return { outcome: 'cancelled', channel }

  const compositeResult = await tryNativeShare({
    ...sharePayload,
    files: [compositeFile],
  })
  if (compositeResult === 'shared') return { outcome: 'shared', channel }
  if (compositeResult === 'cancelled') return { outcome: 'cancelled', channel }

  const outcome = await fallbackShare(channel, enrichedPhoto, text, shareUrl, photoFile, compositeFile)
  return { outcome, channel }
}

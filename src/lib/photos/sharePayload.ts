import { reverseGeocode } from '@/lib/photos/geocoding'
import {
  buildPhotoPdfShareText,
  getEmailShareUrl,
  getWhatsAppShareUrl,
} from '@/lib/photos/share'
import {
  createPhotoReportPdfFile,
  downloadPhotoReportPdf,
} from '@/lib/photos/photoReportPdf'
import { shareWithFiles } from '@/lib/share/webShare'
import { downloadPdfBlob } from '@/lib/print/pdfDownload'
import type { CompanyHeader } from '@/lib/print/printDocument'
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

function needsAddressLookup(photo: GpsPhoto): boolean {
  const shareAddress = formatPhotoShareAddress(photo)
  return shareAddress === ADDRESS_PENDING || shareAddress === ADDRESS_GEOCODE_FAILED
}

export async function ensurePhotoAddress(photo: GpsPhoto): Promise<GpsPhoto> {
  if (!needsAddressLookup(photo)) return photo

  try {
    const geocoded = await reverseGeocode(photo.gps_lat, photo.gps_lng)
    if (!geocoded.address_full?.trim()) return photo

    const { updateGpsPhotoAddress } = await import('@/lib/photos/api')
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

async function tryNativePdfShare(input: {
  title: string
  text: string
  files: File[]
}): Promise<'shared' | 'cancelled' | null> {
  const result = await shareWithFiles(input)
  if (result === 'shared' || result === 'cancelled') return result
  return null
}

async function fallbackPdfShare(
  channel: PhotoShareChannel,
  photo: GpsPhoto,
  text: string,
  pdfFile: File
): Promise<PhotoShareOutcome> {
  downloadPdfBlob(pdfFile, pdfFile.name)

  if (channel === 'email') {
    window.location.href = getEmailShareUrl(
      `${text}\n\n(PDF doklad „${pdfFile.name}" byl stažen – přiložte ho k e-mailu.)`,
      `Fotodokumentace VH Bulldig – ${photo.order_name?.trim() || 'zakázka'}`
    )
    return 'opened'
  }

  if (channel === 'whatsapp') {
    window.open(
      getWhatsAppShareUrl(
        `${text}\n\n(PDF doklad „${pdfFile.name}" byl stažen – přiložte ho ke zprávě.)`
      ),
      '_blank',
      'noopener,noreferrer'
    )
    return 'opened'
  }

  if (channel === 'messenger' || channel === 'native') {
    try {
      await navigator.clipboard.writeText(text)
      return 'copied'
    } catch {
      return 'downloaded'
    }
  }

  return 'downloaded'
}

export async function shareGpsPhoto(
  photo: GpsPhoto,
  channel: PhotoShareChannel,
  company?: CompanyHeader | null
): Promise<PhotoShareResult> {
  assertPhotoFile(photo)

  const enrichedPhoto = await ensurePhotoAddress(photo)
  const text = buildPhotoPdfShareText(enrichedPhoto)
  const title = `GPS fotodoklad – ${enrichedPhoto.order_name?.trim() || 'zakázka'}`
  const pdfFile = await createPhotoReportPdfFile(enrichedPhoto, company)

  const nativeResult = await tryNativePdfShare({
    title,
    text,
    files: [pdfFile],
  })
  if (nativeResult === 'shared') return { outcome: 'shared', channel }
  if (nativeResult === 'cancelled') return { outcome: 'cancelled', channel }

  const outcome = await fallbackPdfShare(channel, enrichedPhoto, text, pdfFile)
  return { outcome, channel }
}

/** Stáhne binární PDF fotodoklad (application/pdf). */
export async function saveGpsPhotoPdf(photo: GpsPhoto, company?: CompanyHeader | null): Promise<void> {
  assertPhotoFile(photo)
  const enrichedPhoto = await ensurePhotoAddress(photo)
  await downloadPhotoReportPdf(enrichedPhoto, company)
}

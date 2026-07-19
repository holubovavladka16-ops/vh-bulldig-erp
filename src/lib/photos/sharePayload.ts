import { reverseGeocode } from '@/lib/photos/geocoding'
import { updateGpsPhotoAddress } from '@/lib/photos/api'
import {
  createPhotoReportPdfFile,
  downloadPhotoReportPdf,
} from '@/lib/photos/photoReportPdf'
import { downloadPdfBlob, sharePdfFile } from '@/lib/print/pdfDownload'
import type { CompanyHeader } from '@/lib/print/printDocument'
import type { GpsPhoto } from '@/types/photos'
import { ADDRESS_GEOCODE_FAILED, ADDRESS_PENDING, formatPhotoShareAddress } from '@/lib/photos/photoDisplay'

export type PhotoShareChannel = 'whatsapp' | 'messenger' | 'email' | 'native'

export type PhotoShareOutcome = 'shared' | 'cancelled' | 'downloaded'

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

async function tryNativePdfShare(pdfFile: File): Promise<'shared' | 'cancelled' | null> {
  const result = await sharePdfFile(pdfFile, pdfFile.name)
  if (result === 'shared') return 'shared'
  if (result === 'cancelled') return 'cancelled'
  return null
}

function downloadPdfFallback(pdfFile: File): PhotoShareOutcome {
  downloadPdfBlob(pdfFile, pdfFile.name)
  return 'downloaded'
}

/**
 * Sdílí GPS fotodoklad výhradně jako binární PDF.
 * Web Share API: pouze soubor, bez textu a bez URL.
 * Fallback: stažení PDF – nikdy wa.me/mailto/veřejný odkaz.
 */
export async function shareGpsPhoto(
  photo: GpsPhoto,
  channel: PhotoShareChannel,
  company?: CompanyHeader | null
): Promise<PhotoShareResult> {
  assertPhotoFile(photo)

  const enrichedPhoto = await ensurePhotoAddress(photo)
  const pdfFile = await createPhotoReportPdfFile(enrichedPhoto, company)

  const nativeResult = await tryNativePdfShare(pdfFile)
  if (nativeResult === 'shared') return { outcome: 'shared', channel }
  if (nativeResult === 'cancelled') return { outcome: 'cancelled', channel }

  return { outcome: downloadPdfFallback(pdfFile), channel }
}

/** Stáhne binární PDF fotodoklad (application/pdf). */
export async function saveGpsPhotoPdf(photo: GpsPhoto, company?: CompanyHeader | null): Promise<void> {
  assertPhotoFile(photo)
  const enrichedPhoto = await ensurePhotoAddress(photo)
  await downloadPhotoReportPdf(enrichedPhoto, company)
}

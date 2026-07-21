import { getGoogleMapsUrl, getMapyCzShowMapUrl } from '@/lib/photos/mapLinks'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatGpsLocationLabel,
  formatPhotoAddress,
  getOrderDisplayName,
  getPhotoAuthorName,
} from '@/lib/photos/photoDisplay'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  buildProfessionalPrintDocument,
  downloadHtmlDocument,
  escHtml,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import { downloadPdfBlob, htmlToPdfBlob } from '@/lib/print/pdfDownload'
import type { GpsPhoto } from '@/types/photos'

const PHOTO_PDF_EXTRA = `
  .gfa-photo-page { page-break-before: always; }
  .gfa-photo-page:first-child { page-break-before: auto; }
  .gfa-photo-wrap { page-break-inside: avoid; border: 1px solid #d9e2ef; border-radius: 6px; padding: 12px; margin-bottom: 16px; }
  .gfa-photo-wrap img.main { max-height: 360px; width: 100%; object-fit: contain; border: 1px solid #ddd; }
  .gfa-meta { font-size: 10pt; line-height: 1.5; margin-top: 10px; color: #333; }
  .gfa-meta a { color: #1e3a5f; }
`

function buildPhotoPageHtml(photo: GpsPhoto, index: number, total: number): string {
  const photoUrl = getGpsPhotoUrl(photo.file_path)
  const address = formatPhotoAddress(photo)
  const gps = formatGpsLocationLabel(photo.gps_lat, photo.gps_lng, photo.gps_accuracy)
  const mapUrl = getMapyCzShowMapUrl(photo.gps_lat, photo.gps_lng)
  const googleUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const title = photo.title?.trim() || `Fotografie ${index + 1} / ${total}`

  return `
    <div class="gfa-photo-page gfa-photo-wrap">
      <h2>${escHtml(title)}</h2>
      <img class="main" src="${escHtml(photoUrl)}" alt="${escHtml(title)}" />
      <div class="gfa-meta">
        <div><strong>Datum a čas:</strong> ${escHtml(formatCaptureDateLabel(photo.captured_date))} ${escHtml(formatCaptureTime(photo.captured_time))}</div>
        <div><strong>Adresa:</strong> <a href="${escHtml(mapUrl)}">${escHtml(address)}</a></div>
        <div><strong>GPS:</strong> <a href="${escHtml(googleUrl)}">${escHtml(gps)}</a></div>
        <div><strong>Zakázka:</strong> ${escHtml(getOrderDisplayName(photo))}</div>
        <div><strong>Autor:</strong> ${escHtml(getPhotoAuthorName(photo))}</div>
        ${photo.device_info ? `<div><strong>Zařízení:</strong> ${escHtml(photo.device_info)}</div>` : ''}
        ${photo.note?.trim() ? `<div><strong>Poznámka:</strong> ${escHtml(photo.note.trim())}</div>` : ''}
      </div>
    </div>
  `
}

export function buildArchivePhotosHtml(photos: GpsPhoto[], company?: CompanyHeader | null): string {
  const body = photos.map((photo, index) => buildPhotoPageHtml(photo, index, photos.length)).join('')
  return buildProfessionalPrintDocument('Fotodokumentace s GPS', body, {
    company,
    extraStyles: PHOTO_PDF_EXTRA,
  })
}

export function openArchivePhotosPrint(photos: GpsPhoto[], company?: CompanyHeader | null): void {
  openPrintDocument(buildArchivePhotosHtml(photos, company))
}

export function downloadArchivePhotosHtml(photos: GpsPhoto[], company?: CompanyHeader | null): void {
  downloadHtmlDocument(buildArchivePhotosHtml(photos, company), 'fotodokumentace-gps.html')
}

export async function generateArchivePhotosPdf(
  photos: GpsPhoto[],
  company?: CompanyHeader | null
): Promise<Blob> {
  const html = buildArchivePhotosHtml(photos, company)
  return htmlToPdfBlob(html)
}

export async function exportArchivePhotosPdf(
  photos: GpsPhoto[],
  company?: CompanyHeader | null,
  fileName = 'fotodokumentace-gps.pdf'
): Promise<Blob> {
  const blob = await generateArchivePhotosPdf(photos, company)
  downloadPdfBlob(blob, fileName)
  return blob
}

export function buildArchiveShareText(photo: GpsPhoto): string {
  const address = formatPhotoAddress(photo)
  const gps = formatGpsLocationLabel(photo.gps_lat, photo.gps_lng, photo.gps_accuracy)
  const mapUrl = getMapyCzShowMapUrl(photo.gps_lat, photo.gps_lng)
  const lines = [
    photo.title?.trim() || 'Fotodokumentace s GPS',
    `Datum: ${formatCaptureDateLabel(photo.captured_date)} ${formatCaptureTime(photo.captured_time)}`,
    `Adresa: ${address}`,
    `GPS: ${gps}`,
    `Zakázka: ${getOrderDisplayName(photo)}`,
    `Mapa: ${mapUrl}`,
  ]
  if (photo.note?.trim()) lines.push(`Poznámka: ${photo.note.trim()}`)
  return lines.join('\n')
}

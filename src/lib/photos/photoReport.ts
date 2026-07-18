import { getGoogleMapsUrl, getStaticMapImageUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatCaptureWeekday,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
  getOrderDisplayName,
} from '@/lib/photos/photoDisplay'
import {
  assertValidPdfBlob,
  downloadPdfBlob,
  htmlToPdfBlob,
  sanitizePdfFileName,
  sharePdfFile,
} from '@/lib/print/pdfDownload'
import { withPdfGeneratingOverlay } from '@/lib/print/pdfMobileUi'
import {
  buildProfessionalReportDocument,
  escHtml,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { GpsPhoto } from '@/types/photos'

export function buildPhotoReportHtml(photo: GpsPhoto): string {
  const photoUrl = getGpsPhotoUrl(photo.file_path)
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const mapImageUrl = getStaticMapImageUrl(photo.gps_lat, photo.gps_lng, 640, 180)
  const address = formatPhotoAddress(photo)
  const orderName = getOrderDisplayName(photo)
  const coords = formatGpsCoordinatesCompact(photo.gps_lat, photo.gps_lng)
  const capturedBy = photo.creator_name?.trim() || photo.worker_name?.trim() || '—'
  const weekday = formatCaptureWeekday(photo.captured_date)
  const dateLabel = formatCaptureDateLabel(photo.captured_date)
  const timeLabel = formatCaptureTime(photo.captured_time)

  return `
    <section class="doc-section">
      <div class="doc-photo-wrap" style="position:relative">
        <img src="${escHtml(photoUrl)}" alt="Fotografie" style="max-height:420px;width:100%;object-fit:contain" />
        <div style="position:absolute;bottom:12px;left:12px;background:rgba(0,0,0,0.75);color:#fff;padding:8px 12px;border-radius:8px;border:1px solid #a3e635">
          <div style="color:#fcd34d;font-weight:bold;font-size:11px;text-transform:uppercase">${escHtml(orderName)}</div>
          <div style="font-family:monospace;font-size:11px;margin-top:4px">📍 ${escHtml(coords)}</div>
        </div>
      </div>
    </section>

    <section class="doc-section">
      <h2>Údaje o fotografii</h2>
      <table class="doc-table">
        <tr><th>Den</th><td>${escHtml(weekday)}</td></tr>
        <tr><th>Datum pořízení</th><td>${escHtml(dateLabel)}</td></tr>
        <tr><th>Čas pořízení</th><td>${escHtml(timeLabel)}</td></tr>
        <tr><th>GPS souřadnice</th><td>${escHtml(coords)}</td></tr>
        <tr><th>Přesnost GPS</th><td>${photo.gps_accuracy != null ? `±${Math.round(photo.gps_accuracy)} m` : '—'}</td></tr>
        <tr><th>Adresa</th><td>${escHtml(address)}</td></tr>
        <tr><th>Popis prací / poznámka</th><td>${escHtml(photo.note ?? '—')}</td></tr>
        <tr><th>Zakázka</th><td>${escHtml(orderName)}</td></tr>
        <tr><th>Pořídil</th><td>${escHtml(capturedBy)}</td></tr>
      </table>
    </section>

    <section class="doc-section">
      <h2>Mapa místa pořízení</h2>
      <div class="doc-photo-wrap">
        <a href="${escHtml(mapUrl)}">
          <img src="${escHtml(mapImageUrl)}" alt="Mapa GPS polohy" style="max-height:180px;object-fit:cover;width:100%" />
        </a>
      </div>
      <p>
        <a href="${escHtml(mapUrl)}">Google Maps</a> ·
        <a href="${escHtml(getStreetViewUrl(photo.gps_lat, photo.gps_lng))}">Street View</a>
      </p>
    </section>
  `
}

export function buildPhotoReportDocument(photo: GpsPhoto, company?: CompanyHeader | null): string {
  return buildProfessionalReportDocument(
    {
      title: 'GPS fotodoklad – stavební dokumentace',
      documentNumber: `FOTO-${photo.id.slice(0, 8).toUpperCase()}`,
    },
    buildPhotoReportHtml(photo),
    company
  )
}

export function buildPhotoReportPdfFileName(photo: GpsPhoto): string {
  return sanitizePdfFileName(`gps-fotodoklad_${photo.captured_date}_${photo.id.slice(0, 8)}`)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Načtení obrázku pro PDF se nezdařilo.'))
    reader.readAsDataURL(blob)
  })
}

/** Vloží obrázky jako data URL, aby html2canvas vytvořil skutečné PDF i na mobilu. */
async function inlineRemoteImagesInHtml(html: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const images = Array.from(doc.querySelectorAll('img[src]'))

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src')
      if (!src || src.startsWith('data:')) return
      try {
        const response = await fetch(src)
        if (!response.ok) return
        const blob = await response.blob()
        img.setAttribute('src', await blobToDataUrl(blob))
      } catch {
        // ponechat původní URL
      }
    })
  )

  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

export async function buildPhotoReportPdfBlob(
  photo: GpsPhoto,
  company?: CompanyHeader | null
): Promise<Blob> {
  const html = await inlineRemoteImagesInHtml(buildPhotoReportDocument(photo, company))
  const blob = await htmlToPdfBlob(html)
  await assertValidPdfBlob(blob)
  return blob
}

export function printPhotoReport(photo: GpsPhoto, company?: CompanyHeader | null): void {
  openPrintDocument(buildPhotoReportDocument(photo, company), {
    title: 'GPS fotodoklad – stavební dokumentace',
    fileName: buildPhotoReportPdfFileName(photo),
  })
}

export async function downloadPhotoReportPdf(
  photo: GpsPhoto,
  company?: CompanyHeader | null
): Promise<void> {
  const blob = await withPdfGeneratingOverlay(() => buildPhotoReportPdfBlob(photo, company))
  downloadPdfBlob(blob, buildPhotoReportPdfFileName(photo))
}

export type SharePhotoReportPdfResult = 'shared' | 'downloaded' | 'cancelled'

export async function sharePhotoReportPdf(
  photo: GpsPhoto,
  company?: CompanyHeader | null
): Promise<SharePhotoReportPdfResult> {
  const fileName = buildPhotoReportPdfFileName(photo)
  const blob = await withPdfGeneratingOverlay(() => buildPhotoReportPdfBlob(photo, company))

  const shareResult = await sharePdfFile(blob, fileName)
  if (shareResult === 'shared') return 'shared'
  if (shareResult === 'cancelled') return 'cancelled'

  downloadPdfBlob(blob, fileName)
  return 'downloaded'
}

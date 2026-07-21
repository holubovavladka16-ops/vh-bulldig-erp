import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { getMapyCzShowMapUrl } from '@/lib/photos/mapLinks'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatGpsLocationLabel,
  formatPhotoAddress,
  getOrderDisplayName,
} from '@/lib/photos/photoDisplay'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  downloadHtmlDocument,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import {
  assertValidPdfBlob,
  downloadPdfBlob,
  ensurePdfBlob,
} from '@/lib/print/pdfDownload'
import type { GpsPhoto } from '@/types/photos'
import {
  buildGfaPhotosPrintDocument,
  probeImageOrientation,
  type GfaPhotoOrientation,
} from '@/lib/gpsFotoarchiv/gpsFotoarchivPdfLayout'

async function waitForDocumentImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images)
  if (images.length === 0) return

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
    )
  )
}

async function capturePageElementToCanvas(pageEl: HTMLElement): Promise<HTMLCanvasElement> {
  const width = Math.max(pageEl.offsetWidth, pageEl.scrollWidth, 794)
  const height = Math.max(pageEl.offsetHeight, pageEl.scrollHeight, 1123)

  return html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: '#ffffff',
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
  })
}

async function htmlToGfaPdfBlob(html: string): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('PDF generování není dostupné mimo prohlížeč.')
  }

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '210mm'
  iframe.style.height = '297mm'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  try {
    const frameWindow = iframe.contentWindow
    const frameDoc = frameWindow?.document
    if (!frameWindow || !frameDoc) {
      throw new Error('Nelze připravit dokument pro PDF.')
    }

    frameDoc.open()
    frameDoc.write(html)
    frameDoc.close()

    await new Promise<void>((resolve) => {
      if (frameDoc.readyState === 'complete') resolve()
      else iframe.onload = () => resolve()
    })

    if (frameDoc.fonts?.ready) {
      await frameDoc.fonts.ready.catch(() => undefined)
    }

    await waitForDocumentImages(frameDoc)
    await new Promise((resolve) => window.setTimeout(resolve, 300))

    const pages = Array.from(frameDoc.querySelectorAll<HTMLElement>('.gfa-pdf-page'))
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const targets = pages.length > 0 ? pages : [frameDoc.body]

    for (let index = 0; index < targets.length; index += 1) {
      const canvas = await capturePageElementToCanvas(targets[index]!)
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      if (index > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST')
    }

    const blob = ensurePdfBlob(pdf.output('blob') as Blob)
    await assertValidPdfBlob(blob)
    return blob
  } finally {
    iframe.remove()
  }
}

async function resolvePhotoOrientations(photos: GpsPhoto[]): Promise<GfaPhotoOrientation[]> {
  return Promise.all(photos.map((photo) => probeImageOrientation(getGpsPhotoUrl(photo.file_path))))
}

export function buildArchivePhotosHtml(photos: GpsPhoto[], company?: CompanyHeader | null): string {
  const orientations = photos.map(() => 'landscape' as GfaPhotoOrientation)
  return buildGfaPhotosPrintDocument(photos, orientations, company)
}

export async function buildArchivePhotosHtmlAsync(
  photos: GpsPhoto[],
  company?: CompanyHeader | null
): Promise<string> {
  const orientations = await resolvePhotoOrientations(photos)
  return buildGfaPhotosPrintDocument(photos, orientations, company)
}

export function openArchivePhotosPrint(photos: GpsPhoto[], company?: CompanyHeader | null): void {
  void buildArchivePhotosHtmlAsync(photos, company).then(openPrintDocument)
}

export function downloadArchivePhotosHtml(photos: GpsPhoto[], company?: CompanyHeader | null): void {
  void buildArchivePhotosHtmlAsync(photos, company).then((html) =>
    downloadHtmlDocument(html, 'fotodokumentace-gps.html')
  )
}

export async function generateArchivePhotosPdf(
  photos: GpsPhoto[],
  company?: CompanyHeader | null
): Promise<Blob> {
  const html = await buildArchivePhotosHtmlAsync(photos, company)
  return htmlToGfaPdfBlob(html)
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

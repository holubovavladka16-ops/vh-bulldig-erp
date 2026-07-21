import { DEFAULT_APP_LOGO_URL } from '@/constants/branding'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  getGoogleMapsUrl,
  getStaticMapImageUrl,
  getStreetViewUrl,
} from '@/lib/photos/mapLinks'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatCaptureWeekday,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
  getOrderDisplayName,
  getPhotoAuthorName,
} from '@/lib/photos/photoDisplay'
import {
  buildCompanyAddressLine,
  buildCompanyContactLine,
  escHtml,
  formatDocumentCreatedAt,
  resolveCompanyHeader,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { CompanySettings } from '@/types'
import type { GpsPhoto } from '@/types/photos'

/** Vodoznak VH Bulldig – 12 % (požadavek 10–15 %). */
export const GFA_PDF_WATERMARK_OPACITY = 0.12

export const GFA_PDF_EXTRA_STYLES = `
  @page { size: A4 portrait; margin: 0 !important; }
  html, body.gfa-pdf-root {
    margin: 0 !important;
    padding: 0 !important;
    width: 210mm !important;
    background: #ffffff !important;
    color: #111111 !important;
  }
  body.gfa-pdf-root.multi-page {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  body.gfa-pdf-root.single-page {
    height: 297mm !important;
    max-height: 297mm !important;
    overflow: hidden !important;
  }
  .gfa-pdf-shell {
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    max-height: none !important;
  }
  .gfa-pdf-page {
    position: relative;
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    max-height: 297mm;
    padding: 8mm 10mm 9mm;
    box-sizing: border-box;
    background: #ffffff;
    color: #111111;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .gfa-pdf-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .gfa-pdf-watermark {
    position: absolute !important;
    left: 50% !important;
    top: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 120mm !important;
    height: auto !important;
    max-width: 78% !important;
    object-fit: contain !important;
    opacity: ${GFA_PDF_WATERMARK_OPACITY} !important;
    z-index: 0 !important;
    pointer-events: none !important;
  }
  .gfa-pdf-page-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .gfa-pdf-page .doc-header {
    display: grid;
    grid-template-columns: 18mm 1fr;
    gap: 8px;
    margin-bottom: 2mm !important;
    padding-bottom: 2mm !important;
    border-bottom: 2px solid #1e3a5f;
    flex-shrink: 0;
  }
  .gfa-pdf-logo-box {
    width: 18mm;
    height: 18mm;
    max-width: 18mm;
    max-height: 18mm;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .gfa-pdf-company-logo {
    width: 18mm !important;
    height: 18mm !important;
    max-width: 18mm !important;
    max-height: 18mm !important;
    object-fit: contain !important;
    display: block !important;
    mix-blend-mode: multiply !important;
  }
  .gfa-pdf-page .doc-company-name {
    margin: 0;
    font-size: 12pt !important;
    line-height: 1.15;
    color: #1e3a5f;
    font-weight: 700;
  }
  .gfa-pdf-page .doc-company-meta {
    margin: 0 !important;
    font-size: 7.5pt !important;
    line-height: 1.25;
    color: #444;
  }
  .gfa-pdf-page .doc-title-block {
    margin: 0 0 2mm !important;
    text-align: center;
    flex-shrink: 0;
  }
  .gfa-pdf-page .doc-title {
    margin: 0 0 1mm !important;
    font-size: 13pt !important;
    line-height: 1.15;
    color: #1e3a5f;
    font-weight: 700;
  }
  .gfa-pdf-page .doc-meta-line {
    margin: 0 !important;
    font-size: 8pt !important;
    line-height: 1.2;
    color: #555;
  }
  .gfa-pdf-photo-stage {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    margin: 2mm 0 3mm;
    overflow: hidden;
  }
  .gfa-pdf-photo-main {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
    object-position: center center !important;
    border: 1px solid #c5d0de;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .gfa-pdf-photo-stage--portrait .gfa-pdf-photo-main {
    max-height: 158mm;
    max-width: 190mm;
  }
  .gfa-pdf-photo-stage--landscape .gfa-pdf-photo-main {
    max-height: 118mm;
    max-width: 190mm;
  }
  .gfa-pdf-photo-stage--square .gfa-pdf-photo-main {
    max-height: 140mm;
    max-width: 190mm;
  }
  .gfa-pdf-photo-badge {
    position: absolute;
    bottom: 6px;
    left: 6px;
    background: rgba(0, 0, 0, 0.78);
    color: #fff;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #a3e635;
    max-width: calc(100% - 12px);
    z-index: 2;
  }
  .gfa-pdf-photo-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    max-height: 100%;
  }
  .gfa-pdf-photo-badge-order {
    color: #fcd34d;
    font-weight: 700;
    font-size: 8px;
    text-transform: uppercase;
    line-height: 1.2;
  }
  .gfa-pdf-photo-badge-coords {
    font-family: monospace;
    font-size: 8px;
    margin-top: 1px;
    line-height: 1.2;
    word-break: break-all;
  }
  .gfa-pdf-section {
    flex-shrink: 0;
    margin: 0 0 1.5mm !important;
    page-break-inside: avoid;
  }
  .gfa-pdf-section h2 {
    margin: 0 0 1mm !important;
    font-size: 9pt !important;
    padding-bottom: 1px !important;
    line-height: 1.2;
    color: #1e3a5f;
    border-bottom: 1px solid #c5d0de;
  }
  .gfa-pdf-table {
    width: 100%;
    margin: 0 !important;
    font-size: 7.5pt !important;
    border-collapse: collapse;
  }
  .gfa-pdf-table th,
  .gfa-pdf-table td {
    padding: 2px 4px !important;
    line-height: 1.25 !important;
    vertical-align: top;
    word-break: break-word;
    border: 1px solid #c5d0de;
  }
  .gfa-pdf-table th {
    width: 32%;
    background: #eef3f9;
    font-weight: 600;
    color: #1e3a5f;
  }
  .gfa-pdf-table tr:nth-child(even) td {
    background: #f8fafc;
  }
  .gfa-pdf-map-img {
    display: block;
    width: 100%;
    max-height: 22mm !important;
    object-fit: cover;
    border: 1px solid #c5d0de;
  }
  .gfa-pdf-map-links {
    margin: 1mm 0 0 !important;
    font-size: 7.5pt !important;
    line-height: 1.2;
  }
  .gfa-pdf-map-links a {
    color: #1e3a5f;
    text-decoration: underline;
  }
  .gfa-pdf-footer {
    margin-top: auto;
    padding-top: 2mm;
    border-top: 1px solid #c5d0de;
    font-size: 7.5pt;
    color: #666;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
  }
  @media print {
    .gfa-pdf-watermark,
    .gfa-pdf-company-logo,
    .gfa-pdf-photo-main,
    .gfa-pdf-map-img {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`

const PRINT_FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
`

function resolveDefaultLogoUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const logo = DEFAULT_APP_LOGO_URL
  if (logo.startsWith('http')) return logo
  return `${origin}${logo.startsWith('/') ? logo : `/${logo}`}`
}

function formatGpsAccuracyLabel(accuracy: number | null): string {
  if (accuracy == null) return '—'
  return `±${Math.round(accuracy)} m`
}

export type GfaPhotoOrientation = 'landscape' | 'portrait' | 'square'

export function detectPhotoOrientation(width: number, height: number): GfaPhotoOrientation {
  if (width > height * 1.05) return 'landscape'
  if (height > width * 1.05) return 'portrait'
  return 'square'
}

export function probeImageOrientation(url: string): Promise<GfaPhotoOrientation> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(detectPhotoOrientation(img.naturalWidth, img.naturalHeight))
    img.onerror = () => resolve('landscape')
    img.src = url
  })
}

function buildWatermarkHtml(company: CompanyHeader): string {
  const url = company.watermark_url?.trim() || company.logo_url?.trim() || resolveDefaultLogoUrl()
  if (!url) return ''
  return `<img src="${escHtml(url)}" alt="" class="gfa-pdf-watermark" aria-hidden="true" />`
}

function buildPageHeaderHtml(
  company: CompanyHeader,
  meta: { title: string; documentNumber: string; createdAt: string }
): string {
  const logoUrl = company.logo_url?.trim() || resolveDefaultLogoUrl()
  const logo = `<div class="gfa-pdf-logo-box"><img src="${escHtml(logoUrl)}" alt="Logo ${escHtml(company.company_name)}" class="gfa-pdf-company-logo" /></div>`
  const address = buildCompanyAddressLine(company)
  const contact = buildCompanyContactLine(company)
  const ids = [company.ico ? `IČO: ${company.ico}` : '', company.dic ? `DIČ: ${company.dic}` : '']
    .filter(Boolean)
    .join(' · ')

  return `
    <header class="doc-header">
      ${logo}
      <div>
        <p class="doc-company-name">${escHtml(company.company_name)}</p>
        ${company.tagline ? `<p class="doc-company-meta">${escHtml(company.tagline)}</p>` : ''}
        ${address ? `<p class="doc-company-meta">${escHtml(address)}</p>` : ''}
        ${ids ? `<p class="doc-company-meta">${escHtml(ids)}</p>` : ''}
        ${contact ? `<p class="doc-company-meta">${escHtml(contact)}</p>` : ''}
      </div>
    </header>
    <div class="doc-title-block">
      <h1 class="doc-title">${escHtml(meta.title)}</h1>
      <p class="doc-meta-line"><strong>Číslo dokumentu:</strong> ${escHtml(meta.documentNumber)}</p>
      <p class="doc-meta-line"><strong>Datum vytvoření:</strong> ${escHtml(meta.createdAt)}</p>
    </div>
  `
}

function buildPageFooterHtml(company: CompanyHeader, createdAt: string, pageIndex: number, total: number): string {
  const year = new Date().getFullYear()
  return `
    <footer class="gfa-pdf-footer">
      <span>${escHtml(company.company_name)} · ${escHtml(createdAt)}</span>
      <span>© ${year} VH Bulldig s.r.o.</span>
      <span>Strana ${pageIndex + 1} / ${total}</span>
    </footer>
  `
}

function buildPhotoBodyHtml(photo: GpsPhoto, orientation: GfaPhotoOrientation): string {
  const photoUrl = getGpsPhotoUrl(photo.file_path)
  const hasGps = photo.gps_lat != null && photo.gps_lng != null
  const lat = photo.gps_lat
  const lng = photo.gps_lng
  const mapUrl = getGoogleMapsUrl(lat, lng)
  const streetUrl = getStreetViewUrl(lat, lng)
  const mapImageUrl = getStaticMapImageUrl(lat, lng, 640, 120)
  const address = formatPhotoAddress(photo)
  const orderName = getOrderDisplayName(photo)
  const coords = formatGpsCoordinatesCompact(lat, lng)
  const capturedBy = getPhotoAuthorName(photo)
  const weekday = formatCaptureWeekday(photo.captured_date)
  const dateLabel = formatCaptureDateLabel(photo.captured_date)
  const timeLabel = formatCaptureTime(photo.captured_time)
  const accuracyLabel = formatGpsAccuracyLabel(photo.gps_accuracy)
  const title = photo.title?.trim()

  return `
    <section class="gfa-pdf-photo-stage gfa-pdf-photo-stage--${orientation}">
      <div class="gfa-pdf-photo-wrap">
        <img class="gfa-pdf-photo-main" src="${escHtml(photoUrl)}" alt="Fotografie" />
        <div class="gfa-pdf-photo-badge">
          <div class="gfa-pdf-photo-badge-order">${escHtml(orderName)}</div>
          <div class="gfa-pdf-photo-badge-coords">📍 ${escHtml(coords)}</div>
        </div>
      </div>
    </section>

    <section class="gfa-pdf-section">
      <h2>Údaje o fotografii</h2>
      <table class="gfa-pdf-table">
        ${title ? `<tr><th>Název</th><td>${escHtml(title)}</td></tr>` : ''}
        <tr><th>Den</th><td>${escHtml(weekday)}</td></tr>
        <tr><th>Datum pořízení</th><td>${escHtml(dateLabel)}</td></tr>
        <tr><th>Čas pořízení</th><td>${escHtml(timeLabel)}</td></tr>
        <tr><th>GPS souřadnice</th><td>${escHtml(coords)}</td></tr>
        <tr><th>Přesnost GPS</th><td>${escHtml(accuracyLabel)}</td></tr>
        <tr><th>Adresa</th><td>${escHtml(address)}</td></tr>
        <tr><th>Popis prací / poznámka</th><td>${escHtml(photo.note?.trim() || '—')}</td></tr>
        <tr><th>Zakázka</th><td>${escHtml(orderName)}</td></tr>
        <tr><th>Pořídil</th><td>${escHtml(capturedBy)}</td></tr>
        ${photo.device_info ? `<tr><th>Zařízení</th><td>${escHtml(photo.device_info)}</td></tr>` : ''}
      </table>
    </section>

    ${
      hasGps
        ? `
    <section class="gfa-pdf-section">
      <h2>Mapa místa pořízení</h2>
      <img class="gfa-pdf-map-img" src="${escHtml(mapImageUrl)}" alt="Mapa GPS polohy" />
      <p class="gfa-pdf-map-links">
        <a href="${escHtml(mapUrl)}">Google Maps</a> ·
        <a href="${escHtml(streetUrl)}">Street View</a>
      </p>
    </section>
    `
        : ''
    }
  `
}

export function buildGfaPhotoPageHtml(
  photo: GpsPhoto,
  company: CompanyHeader,
  createdAt: string,
  pageIndex: number,
  total: number,
  orientation: GfaPhotoOrientation
): string {
  const title = 'GPS fotodoklad – stavební dokumentace'
  const documentNumber = `FOTO-${photo.id.slice(0, 8).toUpperCase()}`
  const meta = { title, documentNumber, createdAt }

  return `
    <div class="gfa-pdf-page">
      ${buildWatermarkHtml(company)}
      <div class="gfa-pdf-page-body">
        ${buildPageHeaderHtml(company, meta)}
        ${buildPhotoBodyHtml(photo, orientation)}
        ${buildPageFooterHtml(company, createdAt, pageIndex, total)}
      </div>
    </div>
  `
}

export function buildGfaPhotosPrintDocument(
  photos: GpsPhoto[],
  orientations: GfaPhotoOrientation[],
  company?: CompanyHeader | CompanySettings | null
): string {
  const co = resolveCompanyHeader(company)
  const createdAt = formatDocumentCreatedAt()
  const title = 'GPS fotodoklad – stavební dokumentace'
  const pages = photos
    .map((photo, index) =>
      buildGfaPhotoPageHtml(photo, co, createdAt, index, photos.length, orientations[index] ?? 'landscape')
    )
    .join('\n')

  const bodyClass = photos.length > 1 ? 'multi-page' : 'single-page'

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=794" />
  <title>${escHtml(title)}</title>
  ${PRINT_FONT_LINKS}
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Noto Sans", "DejaVu Sans", "Segoe UI", system-ui, sans-serif; }
    ${GFA_PDF_EXTRA_STYLES}
  </style>
</head>
<body class="gfa-pdf-root ${bodyClass}">
  <div class="doc-shell gfa-pdf-shell">
    ${pages}
  </div>
</body>
</html>`
}

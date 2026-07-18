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
  buildProfessionalReportDocument,
  downloadHtmlDocument,
  escHtml,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { GpsPhoto } from '@/types/photos'

/** Print-only layout pro GPS fotodoklad – jedna stránka A4 jako v ERP 7. */
const GPS_PHOTO_REPORT_PRINT_CSS = `
  @page { margin: 0; }
  html, body, .doc-shell {
    max-height: none !important;
    min-height: auto !important;
    height: auto !important;
    width: 210mm;
  }
  body.has-doc-footer:has(.doc-gps-photo-report) {
    padding-bottom: 14mm !important;
  }
  body:has(.doc-gps-photo-report) .doc-header {
    margin-bottom: 10px;
    padding-bottom: 8px;
  }
  body:has(.doc-gps-photo-report) .doc-title-block {
    margin-bottom: 10px;
  }
  body:has(.doc-gps-photo-report) .doc-title {
    font-size: 15pt;
    margin-bottom: 4px;
  }
  body:has(.doc-gps-photo-report) .doc-meta-line {
    margin: 1px 0;
    font-size: 9.5pt;
  }
  .doc-gps-photo-report {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .doc-gps-photo-report .doc-section {
    margin: 4px 0 6px;
    page-break-inside: auto !important;
    break-inside: auto !important;
  }
  .doc-gps-photo-report .doc-section:first-child {
    margin-top: 0;
  }
  .doc-gps-photo-report .doc-section h2 {
    margin: 0 0 4px;
    font-size: 11pt;
    padding-bottom: 2px;
  }
  .doc-gps-photo-report .doc-photo-wrap {
    margin: 4px 0 6px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .doc-gps-photo-report .doc-photo-wrap img.doc-gps-photo-main {
    max-height: 220px !important;
    width: 100%;
    object-fit: contain;
    border: 1px solid #c5d0de;
  }
  .doc-gps-photo-report .doc-photo-wrap img.doc-gps-photo-map {
    max-height: 120px !important;
    width: 100%;
    object-fit: cover;
    border: 1px solid #c5d0de;
  }
  .doc-gps-photo-report .doc-photo-badge {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid #a3e635;
  }
  .doc-gps-photo-report .doc-photo-badge-order {
    color: #fcd34d;
    font-weight: bold;
    font-size: 10px;
    text-transform: uppercase;
  }
  .doc-gps-photo-report .doc-photo-badge-coords {
    font-family: monospace;
    font-size: 10px;
    margin-top: 2px;
  }
  .doc-gps-photo-report .doc-table {
    margin: 2px 0 6px;
    font-size: 9pt;
  }
  .doc-gps-photo-report .doc-table th,
  .doc-gps-photo-report .doc-table td {
    padding: 4px 6px;
  }
  .doc-gps-photo-report .doc-section-map p {
    margin: 4px 0 0;
    font-size: 9pt;
  }
  @media print {
    body:has(.doc-gps-photo-report) .doc-shell {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .doc-gps-photo-report .doc-photo-wrap img {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`

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
    <div class="doc-gps-photo-report">
      <section class="doc-section doc-section-photo">
        <div class="doc-photo-wrap" style="position:relative">
          <img
            class="doc-gps-photo-main"
            src="${escHtml(photoUrl)}"
            alt="Fotografie"
          />
          <div class="doc-photo-badge">
            <div class="doc-photo-badge-order">${escHtml(orderName)}</div>
            <div class="doc-photo-badge-coords">📍 ${escHtml(coords)}</div>
          </div>
        </div>
      </section>

      <section class="doc-section doc-section-meta">
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

      <section class="doc-section doc-section-map">
        <h2>Mapa místa pořízení</h2>
        <div class="doc-photo-wrap">
          <a href="${escHtml(mapUrl)}">
            <img
              class="doc-gps-photo-map"
              src="${escHtml(mapImageUrl)}"
              alt="Mapa GPS polohy"
            />
          </a>
        </div>
        <p>
          <a href="${escHtml(mapUrl)}">Google Maps</a> ·
          <a href="${escHtml(getStreetViewUrl(photo.gps_lat, photo.gps_lng))}">Street View</a>
        </p>
      </section>
    </div>
  `
}

export function buildPhotoReportDocument(photo: GpsPhoto, company?: CompanyHeader | null): string {
  return buildProfessionalReportDocument(
    {
      title: 'GPS fotodoklad – stavební dokumentace',
      documentNumber: `FOTO-${photo.id.slice(0, 8).toUpperCase()}`,
      extraStyles: GPS_PHOTO_REPORT_PRINT_CSS,
    },
    buildPhotoReportHtml(photo),
    company
  )
}

export function printPhotoReport(photo: GpsPhoto, company?: CompanyHeader | null): void {
  openPrintDocument(buildPhotoReportDocument(photo, company))
}

export function downloadPhotoReportHtml(photo: GpsPhoto, company?: CompanyHeader | null): void {
  downloadHtmlDocument(
    buildPhotoReportDocument(photo, company),
    `gps-fotodoklad_${photo.captured_date}_${photo.id.slice(0, 8)}.html`
  )
}

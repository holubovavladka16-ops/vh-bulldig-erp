import { getFotoUrl } from '@/lib/fotodokumentace/api'
import { getGoogleMapsUrl, getStaticMapImageUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatCaptureWeekday,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
} from '@/lib/photos/photoDisplay'
import { escHtml } from '@/lib/print/printDocument'
import type { FotoDokument } from '@/types/fotodokumentace'

function formatGpsAccuracyLabel(accuracy: number | null): string {
  if (accuracy == null) return '—'
  return `±${Math.round(accuracy)} m`
}

function getOrderName(foto: FotoDokument): string {
  return foto.order_name?.trim() || 'OBECNÉ STAVENIŠTĚ'
}

function getAuthorName(foto: FotoDokument): string {
  return foto.creator_name?.trim() || foto.worker_name?.trim() || '—'
}

/** Tělo GPS fotodokladu – ERP 7 layout (1 foto = 1 A4). */
export function buildFotoReportHtml(foto: FotoDokument): string {
  const photoUrl = getFotoUrl(foto.watermarked_file_path ?? foto.file_path)
  const hasGps = foto.gps_lat != null && foto.gps_lng != null
  const lat = foto.gps_lat ?? 0
  const lng = foto.gps_lng ?? 0
  const mapUrl = hasGps ? getGoogleMapsUrl(lat, lng) : '#'
  const streetUrl = hasGps ? getStreetViewUrl(lat, lng) : '#'
  const mapImageUrl = hasGps ? getStaticMapImageUrl(lat, lng, 640, 120) : ''
  const address = formatPhotoAddress({
    address_full: foto.address_full,
    street: foto.street,
    city: foto.city,
    postal_code: foto.postal_code,
    gps_lat: foto.gps_lat ?? 0,
    gps_lng: foto.gps_lng ?? 0,
  })
  const orderName = getOrderName(foto)
  const coords =
    foto.gps_lat != null && foto.gps_lng != null
      ? formatGpsCoordinatesCompact(foto.gps_lat, foto.gps_lng)
      : '—'
  const capturedBy = getAuthorName(foto)
  const weekday = formatCaptureWeekday(foto.captured_date)
  const dateLabel = formatCaptureDateLabel(foto.captured_date)
  const timeLabel = formatCaptureTime(foto.captured_time)
  const accuracyLabel = formatGpsAccuracyLabel(foto.gps_accuracy)

  return `
    <div class="doc-gps-a4-body">
      <section class="doc-section doc-section-photo">
        <div class="doc-photo-wrap doc-photo-wrap-main">
          <img class="doc-photo-main" src="${escHtml(photoUrl)}" alt="Fotografie" />
          <div class="doc-photo-badge">
            <div class="doc-photo-badge-order">${escHtml(orderName)}</div>
            <div class="doc-photo-badge-coords">📍 ${escHtml(coords)}</div>
          </div>
        </div>
      </section>

      <section class="doc-section doc-section-meta">
        <h2>Údaje o fotografii</h2>
        <table class="doc-table doc-table-gps">
          <tr><th>Den</th><td>${escHtml(weekday)}</td></tr>
          <tr><th>Datum pořízení</th><td>${escHtml(dateLabel)}</td></tr>
          <tr><th>Čas pořízení</th><td>${escHtml(timeLabel)}</td></tr>
          <tr><th>GPS souřadnice</th><td>${escHtml(coords)}</td></tr>
          <tr><th>Přesnost GPS</th><td>${escHtml(accuracyLabel)}</td></tr>
          <tr><th>Adresa</th><td>${escHtml(address)}</td></tr>
          <tr><th>Popis prací / poznámka</th><td>${escHtml(foto.note?.trim() || '—')}</td></tr>
          <tr><th>Zakázka</th><td>${escHtml(orderName)}</td></tr>
          <tr><th>Pořídil</th><td>${escHtml(capturedBy)}</td></tr>
        </table>
      </section>

      ${
        hasGps
          ? `
      <section class="doc-section doc-section-map">
        <h2>Mapa místa pořízení</h2>
        <div class="doc-photo-wrap doc-photo-wrap-map">
          ${
            mapImageUrl
              ? `<img class="doc-photo-map" src="${escHtml(mapImageUrl)}" alt="Mapa GPS polohy" />`
              : '<div class="doc-photo-map doc-photo-map-empty">Mapa nedostupná</div>'
          }
        </div>
        <p class="doc-map-links">
          <a href="${escHtml(mapUrl)}">Google Maps</a> ·
          <a href="${escHtml(streetUrl)}">Street View</a>
        </p>
      </section>
      `
          : ''
      }
    </div>
  `
}

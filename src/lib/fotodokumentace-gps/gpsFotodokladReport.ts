import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  getGoogleMapsUrl,
  getMapyCzUrl,
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
import { escHtml } from '@/lib/print/printDocument'
import type { GpsPhoto } from '@/types/photos'

function formatAccuracy(accuracy: number | null): string {
  if (accuracy == null) return '—'
  return `±${Math.round(accuracy)} m`
}

function hasGps(photo: GpsPhoto): boolean {
  return photo.gps_lat != null && photo.gps_lng != null
}

/** HTML tělo jedné strany GPS fotodokladu – Modul 13. */
export function buildGpsFotodokladPageBody(photo: GpsPhoto): string {
  const photoUrl = getGpsPhotoUrl(photo.file_path)
  const gpsOk = hasGps(photo)
  const lat = photo.gps_lat ?? 0
  const lng = photo.gps_lng ?? 0
  const mapyUrl = gpsOk ? getMapyCzUrl(lat, lng) : '#'
  const googleUrl = gpsOk ? getGoogleMapsUrl(lat, lng) : '#'
  const streetUrl = gpsOk ? getStreetViewUrl(lat, lng) : '#'
  const mapImageUrl = gpsOk ? getStaticMapImageUrl(lat, lng, 640, 120) : ''
  const coords = gpsOk ? formatGpsCoordinatesCompact(lat, lng) : '—'
  const orderName = getOrderDisplayName(photo)
  const author = getPhotoAuthorName(photo)
  const address = formatPhotoAddress(photo)

  return `
    <div class="fdg-a4-body">
      <section class="doc-section doc-section-photo">
        <div class="doc-photo-wrap doc-photo-wrap-main">
          <img class="doc-photo-main" src="${escHtml(photoUrl)}" alt="Fotografie" />
          ${
            gpsOk
              ? `<div class="doc-photo-badge">
            <div class="doc-photo-badge-order">${escHtml(orderName)}</div>
            <div class="doc-photo-badge-coords">📍 ${escHtml(coords)}</div>
          </div>`
              : ''
          }
        </div>
      </section>

      <section class="doc-section doc-section-meta">
        <h2>Údaje o fotografii</h2>
        <table class="doc-table doc-table-gps">
          <tr><th>Den</th><td>${escHtml(formatCaptureWeekday(photo.captured_date))}</td></tr>
          <tr><th>Datum pořízení</th><td>${escHtml(formatCaptureDateLabel(photo.captured_date))}</td></tr>
          <tr><th>Čas pořízení</th><td>${escHtml(formatCaptureTime(photo.captured_time))}</td></tr>
          <tr><th>GPS souřadnice</th><td>${escHtml(coords)}</td></tr>
          <tr><th>Přesnost GPS</th><td>${escHtml(formatAccuracy(photo.gps_accuracy))}</td></tr>
          <tr><th>Adresa</th><td>${escHtml(address)}</td></tr>
          <tr><th>Popis prací / poznámka</th><td>${escHtml(photo.note?.trim() || '—')}</td></tr>
          <tr><th>Zakázka</th><td>${escHtml(orderName)}</td></tr>
          <tr><th>Pořídil</th><td>${escHtml(author)}</td></tr>
        </table>
      </section>

      ${
        gpsOk
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
          <a href="${escHtml(mapyUrl)}">Mapy.cz</a> ·
          <a href="${escHtml(googleUrl)}">Google Maps</a> ·
          <a href="${escHtml(streetUrl)}">Street View</a>
        </p>
      </section>`
          : ''
      }
    </div>
  `
}

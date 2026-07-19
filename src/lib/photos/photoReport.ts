import { getMapyCzUrl, getGoogleMapsUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatCaptureWeekday,
  formatGpsCoordinatesCompact,
  formatPhotoAddress,
  getOrderDisplayName,
} from '@/lib/photos/photoDisplay'
import { escHtml } from '@/lib/print/printDocument'
import type { GpsPhoto } from '@/types/photos'

function formatGpsAccuracyLabel(accuracy: number | null): string {
  if (accuracy == null) return '—'
  const rounded = Math.round(accuracy)
  return `±${rounded} m`
}

export function buildPhotoReportHtml(photo: GpsPhoto): string {
  const photoUrl = getGpsPhotoUrl(photo.file_path)
  const mapyCzUrl = getMapyCzUrl(photo.gps_lat, photo.gps_lng)
  const googleMapsUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const streetViewUrl = getStreetViewUrl(photo.gps_lat, photo.gps_lng)
  const address = formatPhotoAddress(photo)
  const orderName = getOrderDisplayName(photo)
  const coords = formatGpsCoordinatesCompact(photo.gps_lat, photo.gps_lng)
  const capturedBy = photo.creator_name?.trim() || photo.worker_name?.trim() || '—'
  const weekday = formatCaptureWeekday(photo.captured_date)
  const dateLabel = formatCaptureDateLabel(photo.captured_date)
  const timeLabel = formatCaptureTime(photo.captured_time)
  const accuracyLabel = formatGpsAccuracyLabel(photo.gps_accuracy)

  return `
    <div class="doc-gps-a4-body">
      <section class="doc-section doc-section-photo">
        <div class="doc-photo-wrap doc-photo-wrap-main">
          <img class="doc-photo-main" src="${escHtml(photoUrl)}" alt="Fotografie" />
        </div>
      </section>

      <section class="doc-section doc-section-meta">
        <h2>Údaje o fotografii</h2>
        <table class="doc-table doc-table-gps">
          <tr><th>Den</th><td>${escHtml(weekday)}</td></tr>
          <tr><th>Datum pořízení</th><td>${escHtml(dateLabel)}</td></tr>
          <tr><th>Čas pořízení</th><td>${escHtml(timeLabel)}</td></tr>
          <tr><th>GPS souřadnice</th><td>${escHtml(coords)}</td></tr>
          <tr><th>Přesnost polohy</th><td>${escHtml(accuracyLabel)}</td></tr>
          <tr><th>Adresa</th><td>${escHtml(address)}</td></tr>
          <tr><th>Popis prací / poznámka</th><td>${escHtml(photo.note ?? '—')}</td></tr>
          <tr><th>Zakázka</th><td>${escHtml(orderName)}</td></tr>
          <tr><th>Pořídil</th><td>${escHtml(capturedBy)}</td></tr>
        </table>
      </section>

      <section class="doc-section doc-section-links">
        <h2>Odkazy na mapy</h2>
        <div class="doc-map-links">
          <a href="${escHtml(mapyCzUrl)}" target="_blank">Mapy.cz</a>
          <a href="${escHtml(googleMapsUrl)}" target="_blank">Google Maps</a>
          <a href="${escHtml(streetViewUrl)}" target="_blank">Street View</a>
        </div>
      </section>
    </div>
  `
}

import { formatDate, formatTime } from '@/constants/workers'
import { getGoogleMapsUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  buildCompanyHeaderHtml,
  buildPrintDocument,
  downloadHtmlDocument,
  escHtml,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { GpsPhoto } from '@/types/photos'

function row(label: string, value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return `<tr><th>${escHtml(label)}</th><td>${escHtml(value)}</td></tr>`
}

export function buildPhotoReportHtml(photo: GpsPhoto, company?: CompanyHeader | null): string {
  const photoUrl = getGpsPhotoUrl(photo.file_path)
  const mapUrl = getGoogleMapsUrl(photo.gps_lat, photo.gps_lng)
  const streetViewUrl = getStreetViewUrl(photo.gps_lat, photo.gps_lng)

  return `
    <div class="report">
      ${buildCompanyHeaderHtml(company, 'Fotodokumentace s GPS')}

      <div class="photo-wrap">
        <img src="${escHtml(photoUrl)}" alt="Fotografie" />
      </div>

      <table>
        ${row('Datum pořízení', formatDate(photo.captured_date))}
        ${row('Čas pořízení', formatTime(photo.captured_time))}
        ${row('GPS souřadnice', `${photo.gps_lat.toFixed(6)}, ${photo.gps_lng.toFixed(6)}`)}
        ${row('Přesná adresa', photo.address_full)}
        ${row('Ulice', photo.street)}
        ${row('Město', photo.city)}
        ${row('PSČ', photo.postal_code)}
        ${row('Stát', photo.country)}
        ${row('Poznámka', photo.note)}
        ${row('Zakázka', photo.order_name ?? '')}
        ${row('Zaměstnanec', photo.worker_name ?? '')}
      </table>

      <h2>Mapa</h2>
      <p><a href="${escHtml(mapUrl)}">${escHtml(mapUrl)}</a></p>

      <h2>Pohled z ulice</h2>
      <p><a href="${escHtml(streetViewUrl)}">${escHtml(streetViewUrl)}</a></p>

      <p class="footer">Vygenerováno z ERP VH Bulldig · ${escHtml(formatDate(new Date().toISOString().slice(0, 10)))}</p>
    </div>
  `
}

export function buildPhotoReportDocument(photo: GpsPhoto, company?: CompanyHeader | null): string {
  return buildPrintDocument(
    `Fotodokumentace ${formatDate(photo.captured_date)}`,
    buildPhotoReportHtml(photo, company)
  )
}

export function printPhotoReport(photo: GpsPhoto, company?: CompanyHeader | null): void {
  openPrintDocument(buildPhotoReportDocument(photo, company))
}

export function downloadPhotoReportHtml(photo: GpsPhoto, company?: CompanyHeader | null): void {
  downloadHtmlDocument(
    buildPhotoReportDocument(photo, company),
    `fotodokumentace_${photo.captured_date}_${photo.id.slice(0, 8)}.html`
  )
}

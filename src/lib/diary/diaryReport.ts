import { formatDate, formatTime } from '@/constants/workers'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  buildCompanyHeaderHtml,
  buildPrintDocument,
  downloadHtmlDocument,
  escHtml,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { ConstructionDiaryDetail } from '@/types/diary'

function row(label: string, value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '') return ''
  return `<tr><th>${escHtml(label)}</th><td>${escHtml(value)}</td></tr>`
}

export function buildDiaryReportHtml(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): string {
  const photosHtml =
    entry.photos.length === 0
      ? '<p>Bez fotografií.</p>'
      : entry.photos
          .map(
            (photo) => `
              <div class="photo-block">
                <img src="${escHtml(getGpsPhotoUrl(photo.file_path))}" alt="Fotografie" />
                <p><strong>${escHtml(formatDate(photo.captured_date))} ${escHtml(formatTime(photo.captured_time))}</strong></p>
                <p>${escHtml(photo.address_full)}</p>
                <p>GPS: ${escHtml(photo.gps_lat.toFixed(6))}, ${escHtml(photo.gps_lng.toFixed(6))}</p>
              </div>
            `
          )
          .join('')

  return `
    <div class="report">
      ${buildCompanyHeaderHtml(company, 'Stavební deník')}

      <table>
        ${row('Datum', formatDate(entry.entry_date))}
        ${row('Zakázka', entry.order_name ?? '')}
        ${row('Počasí', entry.weather)}
        ${row('Počet dělníků', entry.worker_count)}
        ${row('Jména zaměstnanců', entry.worker_names)}
        ${row('Použitá technika', entry.equipment)}
      </table>

      <h2>Popis provedených prací</h2>
      <p class="text-block">${escHtml(entry.work_description).replace(/\n/g, '<br />')}</p>

      <h2>Fotodokumentace</h2>
      ${photosHtml}

      <p class="footer">Vygenerováno z ERP VH Bulldig · ${escHtml(formatDate(new Date().toISOString().slice(0, 10)))}</p>
    </div>
  `
}

export function buildDiaryReportDocument(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): string {
  return buildPrintDocument(buildDiaryReportTitle(entry), buildDiaryReportHtml(entry, company))
}

export function printDiaryReport(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): void {
  openPrintDocument(buildDiaryReportDocument(entry, company))
}

export function downloadDiaryReportHtml(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): void {
  downloadHtmlDocument(
    buildDiaryReportDocument(entry, company),
    `stavebni_denik_${entry.entry_date}_${entry.id.slice(0, 8)}.html`
  )
}

export function buildDiaryReportTitle(entry: ConstructionDiaryDetail): string {
  return `Stavební deník – ${formatDate(entry.entry_date)} – ${entry.order_name ?? 'Zakázka'}`
}

import { DEFAULT_APP_LOGO_URL } from '@/constants/branding'
import { formatDiaryWeather } from '@/constants/diary'
import { formatDate, formatTime } from '@/constants/workers'
import { getGoogleMapsUrl, getMapyCzUrl, getStaticMapImageUrl, getStreetViewUrl } from '@/lib/photos/mapLinks'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import {
  formatCaptureDateLabel,
  formatCaptureTime,
  formatGpsLocationLabel,
  getOrderDisplayName,
  getPhotoAddressDetails,
} from '@/lib/photos/photoDisplay'
import {
  buildProfessionalDocumentFooter,
  buildProfessionalDocumentHeader,
  buildProfessionalPrintDocument,
  downloadHtmlDocument,
  escHtml,
  openPreviewDocument,
  openPrintDocument,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { ConstructionDiaryDetail } from '@/types/diary'
import type { GpsPhoto } from '@/types/photos'

const DIARY_PRINT_EXTRA = `
  .diary-entry-page { page-break-before: always; }
  .diary-entry-page:first-child { page-break-before: auto; }
  .diary-kv { display: grid; grid-template-columns: 150px 1fr; gap: 4px 12px; font-size: 10pt; margin: 8px 0; }
  .diary-kv .k { color: #666; font-weight: 500; }
  .diary-photo-grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 8px; }
  .diary-photo-item { page-break-inside: avoid; border: 1px solid #d9e2ef; border-radius: 4px; padding: 10px; }
  .diary-photo-item img.photo-main { max-height: 220px; width: 100%; object-fit: contain; border: 1px solid #ddd; }
  .diary-photo-item img.photo-map { max-height: 120px; width: 100%; object-fit: cover; border: 1px solid #ddd; margin-top: 8px; }
  .diary-photo-map-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .diary-photo-map-row img { max-height: 100px; width: 100%; object-fit: cover; border: 1px solid #ddd; }
  .diary-photo-meta { font-size: 9pt; color: #444; margin-top: 6px; line-height: 1.45; }
  .diary-workers { white-space: pre-wrap; }
  .diary-performances { white-space: pre-wrap; font-size: 10pt; }
`

function resolveLogoUrl(company?: CompanyHeader | null): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const logo = company?.logo_url?.trim() || DEFAULT_APP_LOGO_URL
  if (logo.startsWith('http')) return logo
  return `${origin}${logo.startsWith('/') ? logo : `/${logo}`}`
}

function resolveCompany(company?: CompanyHeader | null): CompanyHeader {
  return {
    company_name: company?.company_name ?? 'VH Bulldig s.r.o.',
    logo_url: resolveLogoUrl(company),
    watermark_url: company?.watermark_url ?? '',
    tagline: company?.tagline ?? '',
    ico: company?.ico ?? '',
    dic: company?.dic ?? '',
    address: company?.address ?? '',
    city: company?.city ?? '',
    postal_code: company?.postal_code ?? '',
    phone: company?.phone ?? '',
    email: company?.email ?? '',
    website: company?.website ?? '',
  }
}

function formatEntryNumber(entry: ConstructionDiaryDetail): string {
  if (entry.entry_number != null) return `Zápis č. ${entry.entry_number}`
  return `Zápis ${entry.id.slice(0, 8)}`
}

function formatOrderLabel(entry: ConstructionDiaryDetail): string {
  const parts = [entry.order_number, entry.order_name].filter(Boolean)
  return parts.join(' – ') || '—'
}

function buildPhotoBlockHtml(photo: GpsPhoto): string {
  if (photo.gps_lat == null || photo.gps_lng == null) {
    const photoUrl = getGpsPhotoUrl(photo.file_path)
    return `
    <div class="diary-photo-item">
      <img class="photo-main" src="${escHtml(photoUrl)}" alt="Fotografie" />
      <div class="diary-photo-meta"><p>GPS souřadnice nejsou k dispozici.</p></div>
    </div>`
  }

  const lat = photo.gps_lat
  const lng = photo.gps_lng
  const photoUrl = getGpsPhotoUrl(photo.file_path)
  const mapUrl = getGoogleMapsUrl(lat, lng)
  const mapyUrl = getMapyCzUrl(lat, lng)
  const streetViewUrl = getStreetViewUrl(lat, lng)
  const mapImageUrl = getStaticMapImageUrl(lat, lng, 560, 140)
  const { geocoded, structured } = getPhotoAddressDetails(photo)
  const coords = formatGpsLocationLabel(lat, lng, photo.gps_accuracy)
  const author = photo.creator_name?.trim() || photo.worker_name?.trim() || '—'
  const orderName = getOrderDisplayName(photo)

  return `
    <div class="diary-photo-item">
      <img class="photo-main" src="${escHtml(photoUrl)}" alt="Fotografie" />
      <div class="diary-photo-map-row">
        <a href="${escHtml(mapUrl)}"><img class="photo-map" src="${escHtml(mapImageUrl)}" alt="Mapa – špendlík" /></a>
        <a href="${escHtml(streetViewUrl)}"><img class="photo-map" src="${escHtml(mapImageUrl)}" alt="Street View poloha" /></a>
      </div>
      <div class="diary-photo-meta">
        <div><strong>${escHtml(formatCaptureDateLabel(photo.captured_date))} ${escHtml(formatCaptureTime(photo.captured_time))}</strong></div>
        <div><strong>Adresa (geokódovaná):</strong> ${escHtml(geocoded)}</div>
        ${structured ? `<div><strong>Adresa (ulice, obec, PSČ):</strong> ${escHtml(structured)}</div>` : ''}
        <div><strong>GPS poloha:</strong> ${escHtml(coords)}</div>
        <div><strong>Zakázka:</strong> ${escHtml(orderName)}</div>
        <div><strong>Poznámka:</strong> ${escHtml(photo.note?.trim() || '—')}</div>
        <div><strong>Autor:</strong> ${escHtml(author)}</div>
        <p>
          <a href="${escHtml(mapyUrl)}">Mapy.cz</a> ·
          <a href="${escHtml(streetViewUrl)}">Street View</a> ·
          <a href="${escHtml(mapUrl)}">Google Maps</a>
        </p>
      </div>
    </div>
  `
}

function kvRow(label: string, value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '') return ''
  return `<div class="k">${escHtml(label)}</div><div>${escHtml(value)}</div>`
}

export function buildDiaryEntryBodyHtml(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): string {
  const co = resolveCompany(company)
  const createdAt = `${formatDate(new Date().toISOString().slice(0, 10))} ${formatTime(new Date())}`
  const weather =
    entry.weather || formatDiaryWeather(entry.weather_type, entry.temperature_celsius) || '—'
  const temp =
    entry.temperature_celsius != null && !Number.isNaN(entry.temperature_celsius)
      ? `${entry.temperature_celsius} °C`
      : '—'

  const photosHtml =
    entry.photos.length === 0
      ? '<p>Bez fotografií u tohoto zápisu.</p>'
      : `<div class="diary-photo-grid">${entry.photos.map(buildPhotoBlockHtml).join('')}</div>`

  return `
    ${buildProfessionalDocumentHeader(co, {
      title: 'Stavební deník',
      documentNumber: formatEntryNumber(entry),
      createdAt,
    })}

    <section class="doc-section">
      <h2>Základní údaje</h2>
      <div class="diary-kv">
        ${kvRow('Datum zápisu', formatDate(entry.entry_date))}
        ${kvRow('Zakázka', formatOrderLabel(entry))}
        ${kvRow('Místo stavby', entry.site_location)}
        ${kvRow('Počasí', weather)}
        ${kvRow('Teplota', temp)}
        ${kvRow('Počet dělníků', entry.worker_count)}
      </div>
    </section>

    <section class="doc-section">
      <h2>Přítomní zaměstnanci</h2>
      <p class="diary-workers">${escHtml(entry.worker_names || '—')}</p>
    </section>

    <section class="doc-section">
      <h2>Denní výkony</h2>
      <p class="diary-performances">${escHtml(entry.performances_summary || '—').replace(/\n/g, '<br />')}</p>
    </section>

    <section class="doc-section">
      <h2>Technika a materiál</h2>
      <div class="diary-kv">
        ${kvRow('Technika', entry.equipment || '—')}
        ${kvRow('Materiál', entry.material || '—')}
      </div>
    </section>

    <section class="doc-section">
      <h2>Denní popis práce</h2>
      <p>${escHtml(entry.work_description).replace(/\n/g, '<br />')}</p>
    </section>

    ${entry.note ? `<section class="doc-section"><h2>Poznámka</h2><p>${escHtml(entry.note).replace(/\n/g, '<br />')}</p></section>` : ''}
    ${entry.extraordinary_events ? `<section class="doc-section"><h2>Mimořádné události</h2><p>${escHtml(entry.extraordinary_events).replace(/\n/g, '<br />')}</p></section>` : ''}

    <section class="doc-section">
      <h2>Fotografie</h2>
      ${photosHtml}
    </section>

    <section class="doc-section doc-signatures">
      <div class="doc-sign-box">
        <div class="doc-sign-line">Stavbyvedoucí</div>
        <div class="doc-sign-role">Podpis a razítko</div>
      </div>
      <div class="doc-sign-box">
        <div class="doc-sign-line">Zástupce investora / stavební dozor</div>
        <div class="doc-sign-role">Podpis</div>
      </div>
    </section>

    ${buildProfessionalDocumentFooter(co, createdAt)}
  `
}

export function buildDiaryReportHtml(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): string {
  return `<div class="diary-entry-page">${buildDiaryEntryBodyHtml(entry, company)}</div>`
}

export function buildBulkDiaryReportHtml(entries: ConstructionDiaryDetail[], company?: CompanyHeader | null): string {
  if (entries.length === 0) return '<p>Žádné zápisy k exportu.</p>'
  return entries.map((entry) => buildDiaryReportHtml(entry, company)).join('')
}

export function buildDiaryReportTitle(entry: ConstructionDiaryDetail): string {
  return `Stavební deník – ${formatEntryNumber(entry)} – ${formatDate(entry.entry_date)} – ${entry.order_name ?? 'Zakázka'}`
}

export function buildBulkDiaryReportTitle(entries: ConstructionDiaryDetail[]): string {
  if (entries.length === 0) return 'Stavební deník'
  const first = entries[0]
  const last = entries[entries.length - 1]
  const orderName = entries.every((e) => e.order_id === first.order_id) ? first.order_name : 'Všechny zakázky'
  return `Stavební deník – ${formatDate(first.entry_date)} – ${formatDate(last.entry_date)} – ${orderName ?? 'Export'}`
}

export function buildDiaryReportDocument(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): string {
  return buildProfessionalPrintDocument(buildDiaryReportTitle(entry), buildDiaryReportHtml(entry, company), {
    extraStyles: DIARY_PRINT_EXTRA,
    company,
  })
}

export function buildBulkDiaryReportDocument(entries: ConstructionDiaryDetail[], company?: CompanyHeader | null): string {
  return buildProfessionalPrintDocument(
    buildBulkDiaryReportTitle(entries),
    buildBulkDiaryReportHtml(entries, company),
    { extraStyles: DIARY_PRINT_EXTRA, company }
  )
}

export function printDiaryReport(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): void {
  openPrintDocument(buildDiaryReportDocument(entry, company))
}

export function printBulkDiaryReport(entries: ConstructionDiaryDetail[], company?: CompanyHeader | null): void {
  openPrintDocument(buildBulkDiaryReportDocument(entries, company))
}

export function previewDiaryReport(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): void {
  openPreviewDocument(buildDiaryReportDocument(entry, company))
}

export function previewBulkDiaryReport(entries: ConstructionDiaryDetail[], company?: CompanyHeader | null): void {
  openPreviewDocument(buildBulkDiaryReportDocument(entries, company))
}

export function downloadDiaryReport(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): void {
  const slug = entry.entry_number ?? entry.id.slice(0, 8)
  downloadHtmlDocument(
    buildDiaryReportDocument(entry, company),
    `stavebni_denik_${entry.entry_date}_${slug}.html`
  )
}

export function downloadBulkDiaryReport(entries: ConstructionDiaryDetail[], company?: CompanyHeader | null): void {
  const first = entries[0]?.entry_date ?? 'export'
  const last = entries[entries.length - 1]?.entry_date ?? first
  downloadHtmlDocument(
    buildBulkDiaryReportDocument(entries, company),
    `stavebni_denik_${first}_${last}.html`
  )
}

/** @deprecated použijte downloadDiaryReport */
export function downloadDiaryReportHtml(entry: ConstructionDiaryDetail, company?: CompanyHeader | null): void {
  downloadDiaryReport(entry, company)
}

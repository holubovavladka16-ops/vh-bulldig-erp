import { DEFAULT_APP_LOGO_URL } from '@/constants/branding'
import { buildPhotoReportHtml } from '@/lib/photos/photoReport'
import { assertGpsPhotoPdfBlob } from '@/lib/photos/photoReportPdfSpec'
import {
  assertValidPdfBlob,
  downloadPdfBlob,
  pdfBlobToFile,
  sanitizePdfFileName,
} from '@/lib/print/pdfDownload'
import { openPdfPreview, withPdfGeneratingOverlay } from '@/lib/print/pdfMobileUi'
import {
  buildCompanyAddressLine,
  buildCompanyContactLine,
  escHtml,
  formatDocumentCreatedAt,
  getProfessionalDocumentStyles,
  resolveCompanyHeader,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { GpsPhoto } from '@/types/photos'

const HTML2PDF_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js'

const PRINT_FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
`

const PDF_LOGO_INLINE_STYLE =
  'width:18mm!important;height:18mm!important;max-width:18mm!important;max-height:18mm!important;object-fit:contain!important;display:block!important;mix-blend-multiply!important;'

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

function mmToPx(mm: number): number {
  return Math.round((mm * 96) / 25.4)
}

const A4_WIDTH_PX = mmToPx(A4_WIDTH_MM)
const A4_HEIGHT_PX = mmToPx(A4_HEIGHT_MM)

const PDF_WATERMARK_INLINE_STYLE =
  'position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:120mm!important;height:auto!important;max-width:78%!important;object-fit:contain!important;opacity:0.10!important;z-index:0!important;pointer-events:none!important;'

/** Pevné A4 210×297 mm – celý GPS fotodoklad na jedné stránce bez posouvání. */
const PHOTO_REPORT_ERP7_EXTRA_STYLES = `
  @page { size: A4 portrait; margin: 0 !important; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 210mm !important;
    height: 297mm !important;
    max-height: 297mm !important;
    overflow: hidden !important;
    background: #ffffff !important;
    color: #111111 !important;
  }
  .doc-shell {
    width: 100% !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .pdf-page {
    position: relative;
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    max-height: 297mm;
    padding: 10mm 12mm 12mm;
    box-sizing: border-box;
    background: #ffffff;
    color: #111111;
    overflow: hidden;
  }
  .pdf-content {
    position: relative;
    z-index: 1;
    height: calc(297mm - 22mm - 11mm);
    overflow: hidden;
  }
  .pdf-logo-box {
    width: 18mm;
    height: 18mm;
    max-width: 18mm;
    max-height: 18mm;
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pdf-company-logo {
    width: 18mm !important;
    height: 18mm !important;
    max-width: 18mm !important;
    max-height: 18mm !important;
    object-fit: contain !important;
    display: block !important;
    mix-blend-multiply !important;
  }
  .pdf-watermark {
    position: absolute !important;
    left: 50% !important;
    top: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 120mm !important;
    height: auto !important;
    max-width: 78% !important;
    object-fit: contain !important;
    opacity: 0.10 !important;
    z-index: 0 !important;
    pointer-events: none !important;
  }
  .pdf-page .doc-header {
    display: grid;
    grid-template-columns: 18mm 1fr;
    gap: 8px;
    margin-bottom: 2mm !important;
    padding-bottom: 2mm !important;
    border-bottom: 2px solid #1e3a5f;
  }
  .pdf-page .doc-company-name {
    margin: 0;
    font-size: 12pt !important;
    line-height: 1.15;
  }
  .pdf-page .doc-company-meta {
    margin: 0 !important;
    font-size: 7.5pt !important;
    line-height: 1.25;
  }
  .pdf-page .doc-title-block {
    margin: 0 0 2mm !important;
    text-align: center;
  }
  .pdf-page .doc-title {
    margin: 0 0 1mm !important;
    font-size: 13pt !important;
    line-height: 1.15;
  }
  .pdf-page .doc-meta-line {
    margin: 0 !important;
    font-size: 8pt !important;
    line-height: 1.2;
  }
  .pdf-page .doc-footer {
    left: 12mm !important;
    right: 12mm !important;
    bottom: 7mm !important;
    padding-top: 4px !important;
    font-size: 7.5pt !important;
  }
  body.has-doc-footer {
    padding-bottom: 0 !important;
  }
  .doc-gps-a4-body {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .doc-gps-a4-body .doc-section {
    margin: 1mm 0 !important;
    page-break-inside: auto !important;
    break-inside: auto !important;
  }
  .doc-gps-a4-body h2 {
    margin: 0 0 1mm !important;
    font-size: 9pt !important;
    padding-bottom: 1px !important;
    line-height: 1.2;
  }
  .doc-gps-a4-body .doc-photo-wrap {
    margin: 0 0 1mm !important;
    page-break-inside: avoid;
  }
  .doc-gps-a4-body .doc-photo-wrap-main {
    position: relative;
  }
  .doc-gps-a4-body .doc-photo-main {
    display: block;
    width: 100%;
    max-height: 140mm !important;
    object-fit: contain;
    border: 1px solid #c5d0de;
  }
  .doc-gps-a4-body .doc-section-photo {
    margin: 0 0 2mm !important;
  }
  .doc-gps-a4-body .doc-section-meta {
    margin: 0 0 2mm !important;
  }
  .doc-gps-a4-body .doc-section-links {
    margin: 0 0 2mm !important;
  }
  .doc-gps-a4-body .doc-map-links {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin: 4px 0;
  }
  .doc-gps-a4-body .doc-map-links a {
    color: #1e3a5f;
    text-decoration: underline;
    font-size: 9pt;
  }
  .doc-gps-a4-body .doc-map-links a:hover {
    color: #3b82f6;
  }
  .doc-gps-a4-body .doc-table-gps {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
    font-size: 8.5pt;
  }
  .doc-gps-a4-body .doc-table-gps th {
    width: 35%;
    text-align: left;
    padding: 3px 6px;
    background: #f0f7ff;
    border: 1px solid #c5d0de;
    font-weight: 600;
    color: #1e3a5f;
  }
  .doc-gps-a4-body .doc-table-gps td {
    text-align: left;
    padding: 3px 6px;
    border: 1px solid #c5d0de;
    color: #111111;
  }
  @media print {
    html, body, .pdf-page {
      overflow: hidden !important;
      height: 297mm !important;
      max-height: 297mm !important;
    }
    .pdf-watermark,
    .pdf-company-logo,
    .doc-gps-a4-body .doc-photo-main,
    .doc-gps-a4-body .doc-photo-map {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`

type Html2PdfWorker = {
  set: (options: Record<string, unknown>) => Html2PdfWorker
  from: (element: HTMLElement) => Html2PdfWorker
  outputPdf: (type: 'blob') => Promise<Blob>
}

type Html2PdfFactory = () => Html2PdfWorker

let html2pdfLoadPromise: Promise<void> | null = null

function resolveDefaultLogoUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const logo = DEFAULT_APP_LOGO_URL
  if (logo.startsWith('http')) return logo
  return `${origin}${logo.startsWith('/') ? logo : `/${logo}`}`
}

function buildPhotoReportWatermarkHtml(company: CompanyHeader): string {
  const url = company.watermark_url?.trim()
  if (!url) return ''
  return `<img src="${escHtml(url)}" alt="" class="pdf-watermark" aria-hidden="true" style="${PDF_WATERMARK_INLINE_STYLE}" />`
}

function buildPhotoReportHeaderHtml(
  company: CompanyHeader,
  meta: { title: string; documentNumber: string; createdAt: string }
): string {
  const logoUrl = company.logo_url?.trim() || resolveDefaultLogoUrl()
  const logo = `<div class="pdf-logo-box"><img src="${escHtml(logoUrl)}" alt="Logo ${escHtml(company.company_name)}" class="pdf-company-logo" style="${PDF_LOGO_INLINE_STYLE}" /></div>`
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

function buildPhotoReportFooterHtml(company: CompanyHeader, createdAt: string): string {
  const companyLabel = company.company_name || 'VH Bulldig s.r.o.'
  const year = new Date().getFullYear()

  return `
    <footer class="doc-footer">
      <span>${escHtml(companyLabel)} · ${escHtml(createdAt)}</span>
      <span class="doc-footer-center">© ${year} VH Bulldig s.r.o.</span>
      <span class="doc-footer-right">Strana <span class="page-num"></span></span>
    </footer>
  `
}

export function buildPhotoReportPrintDocument(photo: GpsPhoto, company?: CompanyHeader | null): string {
  const co = resolveCompanyHeader(company)
  const createdAt = formatDocumentCreatedAt()
  const title = 'GPS fotodoklad – stavební dokumentace'
  const documentNumber = `FOTO-${photo.id.slice(0, 8).toUpperCase()}`
  const meta = { title, documentNumber, createdAt }
  const inner = `${buildPhotoReportHeaderHtml(co, meta)}${buildPhotoReportHtml(photo)}${buildPhotoReportFooterHtml(co, createdAt)}`
  const watermark = buildPhotoReportWatermarkHtml(co)
  const styles = getProfessionalDocumentStyles(PHOTO_REPORT_ERP7_EXTRA_STYLES)

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=794" />
  <title>${escHtml(title)}</title>
  ${PRINT_FONT_LINKS}
  <style>${styles}</style>
</head>
<body class="has-doc-footer">
  <div class="pdf-page doc-page">
    ${watermark}
    <div class="pdf-content">
      <div class="doc-shell">
        ${inner}
      </div>
    </div>
  </div>
</body>
</html>`
}

function loadHtml2PdfBundle(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PDF generování není dostupné mimo prohlížeč.'))
  }

  const win = window as Window & { html2pdf?: Html2PdfFactory }
  if (win.html2pdf) return Promise.resolve()

  if (!html2pdfLoadPromise) {
    html2pdfLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-vh-html2pdf]')
      if (existing) {
        if (win.html2pdf) {
          resolve()
          return
        }
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('Načtení PDF knihovny se nezdařilo.')), {
          once: true,
        })
        return
      }

      const script = document.createElement('script')
      script.src = HTML2PDF_CDN
      script.async = true
      script.dataset.vhHtml2pdf = 'true'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Načtení PDF knihovny se nezdařilo.'))
      document.head.appendChild(script)
    })
  }

  return html2pdfLoadPromise
}

async function getHtml2PdfFactory(): Promise<Html2PdfFactory> {
  await loadHtml2PdfBundle()
  const factory = (window as Window & { html2pdf?: Html2PdfFactory }).html2pdf
  if (!factory) throw new Error('PDF knihovna není dostupná.')
  return factory
}

function waitForDocumentImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images)
  if (images.length === 0) return Promise.resolve()

  return Promise.all(
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
  ).then(() => undefined)
}

function enforcePdfImageDimensions(doc: Document): void {
  doc.querySelectorAll<HTMLImageElement>('.pdf-company-logo').forEach((img) => {
    img.removeAttribute('width')
    img.removeAttribute('height')
    img.style.setProperty('width', '18mm', 'important')
    img.style.setProperty('height', '18mm', 'important')
    img.style.setProperty('max-width', '18mm', 'important')
    img.style.setProperty('max-height', '18mm', 'important')
    img.style.setProperty('object-fit', 'contain', 'important')
    img.style.setProperty('display', 'block', 'important')
    img.style.setProperty('mix-blend-multiply', 'multiply', 'important')
  })

  doc.querySelectorAll<HTMLImageElement>('.pdf-watermark').forEach((img) => {
    img.removeAttribute('width')
    img.removeAttribute('height')
    img.style.setProperty('position', 'absolute', 'important')
    img.style.setProperty('left', '50%', 'important')
    img.style.setProperty('top', '50%', 'important')
    img.style.setProperty('transform', 'translate(-50%, -50%)', 'important')
    img.style.setProperty('width', '120mm', 'important')
    img.style.setProperty('height', 'auto', 'important')
    img.style.setProperty('max-width', '78%', 'important')
    img.style.setProperty('object-fit', 'contain', 'important')
    img.style.setProperty('opacity', '0.10', 'important')
    img.style.setProperty('z-index', '0', 'important')
    img.style.setProperty('pointer-events', 'none', 'important')
  })

  const page = doc.querySelector<HTMLElement>('.pdf-page')
  if (page) {
    page.style.setProperty('width', `${A4_WIDTH_MM}mm`, 'important')
    page.style.setProperty('height', `${A4_HEIGHT_MM}mm`, 'important')
    page.style.setProperty('max-height', `${A4_HEIGHT_MM}mm`, 'important')
    page.style.setProperty('overflow', 'hidden', 'important')
    page.style.setProperty('background', '#ffffff', 'important')
    page.style.setProperty('transform', 'none', 'important')
    page.style.setProperty('transform-origin', 'top left', 'important')

    const shell = page.querySelector<HTMLElement>('.doc-shell')
    const contentHeight = shell?.scrollHeight ?? page.scrollHeight
    if (contentHeight > A4_HEIGHT_PX) {
      const scale = A4_HEIGHT_PX / contentHeight
      page.style.setProperty('transform', `scale(${scale})`, 'important')
      page.style.setProperty('transform-origin', 'top left', 'important')
      page.style.setProperty('width', `${A4_WIDTH_MM / scale}mm`, 'important')
    }
  }
}

/** ERP 7 html2pdf capture – jedna pevná A4 stránka (.pdf-page). */
export async function htmlToPhotoReportPdfBlob(html: string): Promise<Blob> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'Generování GPS fotodokladu')
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;visibility:hidden;background:#ffffff;'
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
    enforcePdfImageDimensions(frameDoc)
    await new Promise((resolve) => window.setTimeout(resolve, 350))

    const pageEl = frameDoc.querySelector<HTMLElement>('.pdf-page') ?? frameDoc.body

    const html2pdf = await getHtml2PdfFactory()
    const blob = await html2pdf()
      .set({
        margin: 0,
        filename: 'gps-fotodoklad.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          backgroundColor: '#ffffff',
          width: A4_WIDTH_PX,
          height: A4_HEIGHT_PX,
          windowWidth: A4_WIDTH_PX,
          windowHeight: A4_HEIGHT_PX,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc: Document) => {
            enforcePdfImageDimensions(clonedDoc)
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: { mode: ['avoid-all'] },
      })
      .from(pageEl)
      .outputPdf('blob')

    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('Vygenerovaný PDF soubor je prázdný.')
    }

    const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
    await assertValidPdfBlob(pdfBlob)
    await assertGpsPhotoPdfBlob(pdfBlob)
    return pdfBlob
  } finally {
    iframe.remove()
  }
}

export function getPhotoReportPdfFileName(photo: GpsPhoto): string {
  return sanitizePdfFileName(`gps-fotodoklad_${photo.captured_date}_${photo.id.slice(0, 8)}.pdf`)
}

export async function buildPhotoReportPdfBlob(
  photo: GpsPhoto,
  company?: CompanyHeader | null
): Promise<Blob> {
  const html = buildPhotoReportPrintDocument(photo, company)
  return htmlToPhotoReportPdfBlob(html)
}

export async function downloadPhotoReportPdf(photo: GpsPhoto, company?: CompanyHeader | null): Promise<void> {
  const pdfBlob = await buildPhotoReportPdfBlob(photo, company)
  downloadPdfBlob(pdfBlob, getPhotoReportPdfFileName(photo))
}

export async function openPhotoReportPdfPreview(photo: GpsPhoto, company?: CompanyHeader | null): Promise<void> {
  const html = buildPhotoReportPrintDocument(photo, company)
  const pdfBlob = await buildPhotoReportPdfBlob(photo, company)
  const fileName = getPhotoReportPdfFileName(photo)
  openPdfPreview(pdfBlob, fileName, {
    title: 'GPS fotodoklad – stavební dokumentace',
    shareText: extractDocumentTitleFromHtml(html),
  })
}

function extractDocumentTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match?.[1]?.trim() || 'GPS fotodoklad – stavební dokumentace'
}

export function printPhotoReport(photo: GpsPhoto, company?: CompanyHeader | null): void {
  void withPdfGeneratingOverlay(async () => {
    await openPhotoReportPdfPreview(photo, company)
  }).catch((err) => {
    const message = err instanceof Error ? err.message : 'Generování PDF se nezdařilo.'
    window.alert(message)
  })
}

export async function createPhotoReportPdfFile(
  photo: GpsPhoto,
  company?: CompanyHeader | null
): Promise<File> {
  const pdfBlob = await buildPhotoReportPdfBlob(photo, company)
  return pdfBlobToFile(pdfBlob, getPhotoReportPdfFileName(photo))
}

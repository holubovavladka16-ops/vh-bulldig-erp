import { DEFAULT_APP_LOGO_URL } from '@/constants/branding'
import { buildGpsFotodokladPageBody } from '@/lib/fotodokumentace-gps/gpsFotodokladReport'
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
  buildDocumentWatermarkHtml,
  escHtml,
  formatDocumentCreatedAt,
  getProfessionalDocumentStyles,
  resolveCompanyHeader,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import type { CompanySettings } from '@/types'
import type { GpsPhoto } from '@/types/photos'

const HTML2PDF_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js'

const A4_W_MM = 210
const A4_H_MM = 297
const A4_W_PX = Math.round((A4_W_MM * 96) / 25.4)
const A4_H_PX = Math.round((A4_H_MM * 96) / 25.4)

const FDG_PDF_STYLES = `
  @page { size: A4 portrait; margin: 0 !important; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .pdf-page {
    position: relative; width: 210mm; height: 297mm; min-height: 297mm; max-height: 297mm;
    padding: 10mm 12mm 12mm; box-sizing: border-box; overflow: hidden; background: #fff;
    page-break-after: always;
  }
  .pdf-page:last-child { page-break-after: auto; }
  .pdf-content { position: relative; z-index: 1; height: calc(297mm - 22mm - 11mm); overflow: hidden; }
  .pdf-page .doc-header { display: grid; grid-template-columns: 18mm 1fr; gap: 8px; margin-bottom: 2mm; padding-bottom: 2mm; border-bottom: 2px solid #1e3a5f; }
  .pdf-page .doc-company-name { margin: 0; font-size: 12pt !important; color: #1e3a5f; font-weight: 700; }
  .pdf-page .doc-company-meta { margin: 0 !important; font-size: 7.5pt !important; line-height: 1.25; color: #444; }
  .pdf-page .doc-title-block { margin: 0 0 2mm !important; text-align: center; }
  .pdf-page .doc-title { margin: 0 0 1mm !important; font-size: 13pt !important; color: #1e3a5f; font-weight: 700; }
  .pdf-page .doc-meta-line { margin: 0 !important; font-size: 8pt !important; color: #555; }
  .pdf-page .doc-footer {
    position: absolute; left: 12mm; right: 12mm; bottom: 7mm;
    display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center;
    font-size: 7.5pt !important; color: #666; border-top: 1px solid #ccc; padding-top: 4px;
  }
  .pdf-page .doc-footer-center { text-align: center; }
  .pdf-page .doc-footer-right { text-align: right; }
  .fdg-a4-body h2 { margin: 0 0 1mm !important; font-size: 9pt !important; color: #1e3a5f; font-weight: 700; }
  .fdg-a4-body .doc-photo-main { display: block; width: 100%; max-height: 86mm !important; object-fit: contain; border: 1px solid #c5d0de; }
  .fdg-a4-body .doc-photo-wrap-main { position: relative; margin-bottom: 2mm; }
  .fdg-a4-body .doc-photo-badge {
    position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.78); color: #fff;
    padding: 4px 8px; border-radius: 6px; border: 1px solid #a3e635;
  }
  .fdg-a4-body .doc-photo-badge-order { color: #fcd34d; font-weight: 700; font-size: 8px; text-transform: uppercase; }
  .fdg-a4-body .doc-photo-badge-coords { font-family: monospace; font-size: 8px; margin-top: 1px; }
  .fdg-a4-body .doc-table-gps { width: 100%; border-collapse: collapse; font-size: 7.5pt !important; margin-bottom: 2mm; }
  .fdg-a4-body .doc-table-gps th, .fdg-a4-body .doc-table-gps td { border: 1px solid #c5d0de; padding: 2px 4px; vertical-align: top; }
  .fdg-a4-body .doc-table-gps th { width: 32%; background: #eef3f9; color: #1e3a5f; font-weight: 600; }
  .fdg-a4-body .doc-photo-map { width: 100%; max-height: 24mm !important; object-fit: cover; border: 1px solid #c5d0de; display: block; }
  .fdg-a4-body .doc-map-links { margin: 1mm 0 0; font-size: 7.5pt; }
  .fdg-a4-body .doc-map-links a { color: #1e3a5f; text-decoration: underline; }
  .pdf-watermark { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 120mm; opacity: 0.10; z-index: 0; pointer-events: none; }
  .pdf-company-logo { width: 18mm !important; height: 18mm !important; object-fit: contain !important; }
`

type Html2PdfWorker = {
  set: (o: Record<string, unknown>) => Html2PdfWorker
  from: (el: HTMLElement) => Html2PdfWorker
  outputPdf: (t: 'blob') => Promise<Blob>
}

function resolveLogo(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const logo = DEFAULT_APP_LOGO_URL
  return logo.startsWith('http') ? logo : `${origin}${logo.startsWith('/') ? logo : `/${logo}`}`
}

function buildHeader(company: CompanyHeader, createdAt: string, docNo: string): string {
  const logoUrl = company.logo_url?.trim() || resolveLogo()
  const address = buildCompanyAddressLine(company)
  const contact = buildCompanyContactLine(company)
  const ids = [company.ico ? `IČO: ${company.ico}` : '', company.dic ? `DIČ: ${company.dic}` : '']
    .filter(Boolean)
    .join(' · ')
  return `
    <header class="doc-header">
      <img src="${escHtml(logoUrl)}" alt="Logo" class="pdf-company-logo" />
      <div>
        <p class="doc-company-name">${escHtml(company.company_name)}</p>
        ${company.tagline ? `<p class="doc-company-meta">${escHtml(company.tagline)}</p>` : ''}
        ${address ? `<p class="doc-company-meta">${escHtml(address)}</p>` : ''}
        ${ids ? `<p class="doc-company-meta">${escHtml(ids)}</p>` : ''}
        ${contact ? `<p class="doc-company-meta">${escHtml(contact)}</p>` : ''}
      </div>
    </header>
    <div class="doc-title-block">
      <h1 class="doc-title">GPS fotodoklad – stavební dokumentace</h1>
      <p class="doc-meta-line"><strong>Číslo dokumentu:</strong> ${escHtml(docNo)}</p>
      <p class="doc-meta-line"><strong>Datum vytvoření:</strong> ${escHtml(createdAt)}</p>
    </div>`
}

function buildFooter(company: CompanyHeader, createdAt: string, page: number, total: number): string {
  const year = new Date().getFullYear()
  return `
    <footer class="doc-footer">
      <span>${escHtml(company.company_name)} · ${escHtml(createdAt)}</span>
      <span class="doc-footer-center">© ${year} VH Bulldig s.r.o.</span>
      <span class="doc-footer-right">Strana ${page} / ${total}</span>
    </footer>`
}

function buildSinglePageHtml(
  photo: GpsPhoto,
  company: CompanyHeader,
  createdAt: string,
  page: number,
  total: number
): string {
  const docNo = `FOTO-${photo.id.slice(0, 8).toUpperCase()}`
  const watermark = buildDocumentWatermarkHtml(company)
  const styles = getProfessionalDocumentStyles(FDG_PDF_STYLES)
  const inner = `${buildHeader(company, createdAt, docNo)}${buildGpsFotodokladPageBody(photo)}${buildFooter(company, createdAt, page, total)}`
  return `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8" /><style>${styles}</style></head>
<body><div class="pdf-page">${watermark}<div class="pdf-content">${inner}</div></div></body></html>`
}

function buildBulkHtml(photos: GpsPhoto[], company: CompanyHeader, createdAt: string): string {
  const total = photos.length
  const pages = photos
    .map((photo, i) => {
      const docNo = `FOTO-${photo.id.slice(0, 8).toUpperCase()}`
      const watermark = buildDocumentWatermarkHtml(company)
      const inner = `${buildHeader(company, createdAt, docNo)}${buildGpsFotodokladPageBody(photo)}${buildFooter(company, createdAt, i + 1, total)}`
      return `<div class="pdf-page">${watermark}<div class="pdf-content">${inner}</div></div>`
    })
    .join('')
  const styles = getProfessionalDocumentStyles(FDG_PDF_STYLES)
  return `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8" /><style>${styles}</style></head><body>${pages}</body></html>`
}

async function loadHtml2Pdf(): Promise<() => Html2PdfWorker> {
  const win = window as Window & { html2pdf?: () => Html2PdfWorker }
  if (!win.html2pdf) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = HTML2PDF_CDN
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('PDF knihovna se nenačetla.'))
      document.head.appendChild(s)
    })
  }
  const f = win.html2pdf
  if (!f) throw new Error('PDF knihovna není dostupná.')
  return f
}

async function capturePage(html: string): Promise<Blob> {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;'
  document.body.appendChild(iframe)
  try {
    const doc = iframe.contentDocument!
    doc.open()
    doc.write(html)
    doc.close()
    await new Promise((r) => setTimeout(r, 400))
    await doc.fonts?.ready
    const pageEl = doc.querySelector('.pdf-page') as HTMLElement
    const html2pdf = await loadHtml2Pdf()
    const blob = await html2pdf()
      .set({
        margin: 0,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff', width: A4_W_PX, height: A4_H_PX },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(pageEl)
      .outputPdf('blob')
    return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
  } finally {
    iframe.remove()
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('PDF stránku se nepodařilo načíst.'))
    r.readAsDataURL(blob)
  })
}

export async function buildGpsFotodokladPdfBlob(
  photos: GpsPhoto[],
  company?: CompanyHeader | CompanySettings | null
): Promise<Blob> {
  if (photos.length === 0) throw new Error('Nejsou vybrány fotografie.')
  const co = resolveCompanyHeader(company)
  const createdAt = formatDocumentCreatedAt()

  if (photos.length === 1) {
    const html = buildSinglePageHtml(photos[0], co, createdAt, 1, 1)
    const blob = await capturePage(html)
    await assertValidPdfBlob(blob)
    return blob
  }

  const html = buildBulkHtml(photos, co, createdAt)
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;'
  document.body.appendChild(iframe)
  try {
    const doc = iframe.contentDocument!
    doc.open()
    doc.write(html)
    doc.close()
    await new Promise((r) => setTimeout(r, 500))
    const pageEls = Array.from(doc.querySelectorAll<HTMLElement>('.pdf-page'))
    const html2pdf = await loadHtml2Pdf()
    const pageBlobs: Blob[] = []
    for (const el of pageEls) {
      const b = await html2pdf()
        .set({
          margin: 0,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff', width: A4_W_PX, height: A4_H_PX },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .outputPdf('blob')
      pageBlobs.push(b.type === 'application/pdf' ? b : new Blob([b], { type: 'application/pdf' }))
    }
    const { jsPDF } = await import('jspdf')
    const merged = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
    for (let i = 0; i < pageBlobs.length; i++) {
      const dataUrl = await blobToDataUrl(pageBlobs[i])
      if (i > 0) merged.addPage()
      merged.addImage(dataUrl, 'JPEG', 0, 0, A4_W_MM, A4_H_MM, undefined, 'FAST')
    }
    const out = merged.output('blob') as Blob
    const pdf = out.type === 'application/pdf' ? out : new Blob([out], { type: 'application/pdf' })
    await assertValidPdfBlob(pdf)
    return pdf
  } finally {
    iframe.remove()
  }
}

export function getGpsFotodokladPdfFileName(photo: GpsPhoto): string {
  return sanitizePdfFileName(`gps-fotodoklad_${photo.captured_date}_${photo.id.slice(0, 8)}.pdf`)
}

export async function downloadGpsFotodokladPdf(
  photos: GpsPhoto[],
  company?: CompanyHeader | CompanySettings | null
): Promise<void> {
  const blob = await buildGpsFotodokladPdfBlob(photos, company)
  const name =
    photos.length === 1
      ? getGpsFotodokladPdfFileName(photos[0])
      : sanitizePdfFileName(`gps-fotodoklad_${photos.length}_fotek.pdf`)
  downloadPdfBlob(blob, name)
}

export async function createGpsFotodokladPdfFile(
  photos: GpsPhoto[],
  company?: CompanyHeader | CompanySettings | null
): Promise<File> {
  const blob = await buildGpsFotodokladPdfBlob(photos, company)
  const name =
    photos.length === 1
      ? getGpsFotodokladPdfFileName(photos[0])
      : sanitizePdfFileName(`gps-fotodoklad_${photos.length}_fotek.pdf`)
  return pdfBlobToFile(blob, name)
}

export function previewGpsFotodokladPdf(photos: GpsPhoto[], company?: CompanyHeader | CompanySettings | null): void {
  void withPdfGeneratingOverlay(async () => {
    const blob = await buildGpsFotodokladPdfBlob(photos, company)
    const name =
      photos.length === 1
        ? getGpsFotodokladPdfFileName(photos[0])
        : sanitizePdfFileName(`gps-fotodoklad_${photos.length}_fotek.pdf`)
    openPdfPreview(blob, name, { title: 'GPS fotodoklad – stavební dokumentace' })
  })
}

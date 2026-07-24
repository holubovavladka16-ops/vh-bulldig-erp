import { DEFAULT_APP_LOGO_URL } from '@/constants/branding'
import type { CompanySettings } from '@/types'
import {
  printProfessionalPdf,
} from '@/lib/print/professionalPdfExport'

export { downloadPdfBlob, printPdfBlob, sharePdfFile } from '@/lib/print/pdfDownload'
export { openPdfPreview } from '@/lib/print/pdfMobileUi'
export {
  previewProfessionalPdf,
  printProfessionalPdf,
  downloadProfessionalPdf,
} from '@/lib/print/professionalPdfExport'

export function escHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function kvRow(label: string, value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '' || value === '—') return ''
  return `<div class="k">${escHtml(label)}</div><div>${escHtml(value)}</div>`
}

export const PRINT_FONT_STACK =
  '"Noto Sans", "DejaVu Sans", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'

export const DOCUMENT_WATERMARK_OPACITY = 0.05

export const VH_BRAND_GOLD = '#c9a227'
export const VH_BRAND_BLACK = '#1a1a1a'

/** Inline SVG motiv inženýrských sítí – spolehlivější než data-URI img v html2canvas. */
const ENGINEERING_WATERMARK_SVG = `<svg class="pdf-watermark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" fill="none" aria-hidden="true"><g stroke="#1a1a1a" stroke-width="1.4"><circle cx="200" cy="200" r="32"/><circle cx="80" cy="120" r="16"/><circle cx="320" cy="120" r="16"/><circle cx="80" cy="280" r="16"/><circle cx="320" cy="280" r="16"/><path d="M200 168 L80 120 M200 168 L320 120 M200 232 L80 280 M200 232 L320 280 M96 120 L304 120 M96 280 L304 280 M80 136 L80 264 M320 136 L320 264"/><path d="M120 200 L280 200 M200 120 L200 280"/></g></svg>`

export const PDF_WATERMARK_LAYER_STYLE =
  'position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:100mm!important;height:100mm!important;max-width:50%!important;max-height:50%!important;z-index:0!important;pointer-events:none!important;opacity:0.04!important;overflow:hidden!important;'

const PDF_LOGO_INLINE_STYLE =
  'width:22mm!important;height:22mm!important;max-width:22mm!important;max-height:22mm!important;object-fit:contain!important;display:block!important;'

/** Pevné rozměry loga a vodoznaku v PDF – nesmí používat původní pixelové rozměry obrázku. */
export const PDF_LOGO_SIZE_MM = 22
export const PDF_WATERMARK_WIDTH_MM = 120

const PDF_PAGE_CSS = `
  :root {
    --pdf-black: #111111;
    --pdf-text: #1a1a1a;
    --pdf-text-muted: #4a4a4a;
    --pdf-gold: #d4af37;
    --pdf-gold-dark: #a98216;
    --pdf-border: #d7d7d7;
    --pdf-row-alt: #f7f7f7;
    --pdf-white: #ffffff;
  }
  .pdf-page {
    position: relative;
    width: 210mm;
    min-height: auto;
    height: auto;
    padding: 12mm;
    box-sizing: border-box;
    background: var(--pdf-white) !important;
    color: var(--pdf-text) !important;
    overflow: hidden;
  }
  .pdf-content {
    position: relative;
    z-index: 1;
    color: var(--pdf-text) !important;
    background: transparent;
  }
  .pdf-watermark-layer {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 100mm;
    height: 100mm;
    max-width: 50%;
    max-height: 50%;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    opacity: 0.04;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pdf-watermark-svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .pdf-watermark-company {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 1;
  }
  .pdf-logo-box {
    width: 22mm;
    height: 22mm;
    max-width: 22mm;
    max-height: 22mm;
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pdf-company-logo {
    width: 22mm !important;
    height: 22mm !important;
    max-width: 22mm !important;
    max-height: 22mm !important;
    object-fit: contain !important;
    display: block !important;
  }
`

const PRINT_FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
`

const PROFESSIONAL_TABLE_CSS = `
  .doc-table, .pdf-table { width: 100%; border-collapse: collapse; margin: 10px 0 0; font-size: 10pt; table-layout: fixed; }
  .doc-table th, .doc-table td, .pdf-table th, .pdf-table td {
    border: 1px solid var(--pdf-border);
    padding: 7px 9px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
    text-shadow: none;
  }
  .doc-table > thead > tr > th,
  .pdf-table > thead > tr > th {
    background: var(--pdf-black) !important;
    font-weight: 600;
    color: #ffffff !important;
    border-bottom: 2px solid var(--pdf-gold);
  }
  .doc-table td, .pdf-table td {
    background: var(--pdf-white) !important;
    color: var(--pdf-text) !important;
  }
  .doc-table tbody tr:nth-child(even) td, .pdf-table tbody tr:nth-child(even) td {
    background: var(--pdf-row-alt) !important;
  }
  .doc-table th:nth-child(1), .doc-table td:nth-child(1) { width: 30%; }
  .doc-table th:nth-child(2), .doc-table td:nth-child(2) { width: 10%; }
  .doc-table th:nth-child(3), .doc-table td:nth-child(3) { width: 12%; }
  .doc-table th:nth-child(4), .doc-table td:nth-child(4) { width: 22%; }
  .doc-table th:nth-child(5), .doc-table td:nth-child(5) { width: 26%; }
  .doc-table-report-works { font-size: 8.5pt; }
  .doc-table-report-works th, .doc-table-report-works td { padding: 5px 6px; }
  .doc-table-report-works th:nth-child(1), .doc-table-report-works td:nth-child(1) { width: 9%; }
  .doc-table-report-works th:nth-child(2), .doc-table-report-works td:nth-child(2) { width: 12%; }
  .doc-table-report-works th:nth-child(3), .doc-table-report-works td:nth-child(3) { width: 14%; }
  .doc-table-report-works th:nth-child(4), .doc-table-report-works td:nth-child(4) { width: 16%; }
  .doc-table-report-works th:nth-child(5), .doc-table-report-works td:nth-child(5) { width: 8%; }
  .doc-table-report-works th:nth-child(6), .doc-table-report-works td:nth-child(6) { width: 9%; }
  .doc-table-report-works th:nth-child(7), .doc-table-report-works td:nth-child(7) { width: 14%; }
  .doc-table-report-works th:nth-child(8), .doc-table-report-works td:nth-child(8) { width: 18%; }
  .doc-table-report-daily-attendance { font-size: 9pt; }
  .doc-table-report-daily-attendance th, .doc-table-report-daily-attendance td { padding: 5px 6px; }
  .doc-table-report-daily-attendance th:nth-child(1), .doc-table-report-daily-attendance td:nth-child(1) { width: 12%; }
  .doc-table-report-daily-attendance th:nth-child(2), .doc-table-report-daily-attendance td:nth-child(2) { width: 22%; }
  .doc-table-report-daily-attendance th:nth-child(3), .doc-table-report-daily-attendance td:nth-child(3) { width: 14%; }
  .doc-table-report-daily-attendance th:nth-child(4), .doc-table-report-daily-attendance td:nth-child(4) { width: 14%; }
  .doc-table-report-daily-attendance th:nth-child(5), .doc-table-report-daily-attendance td:nth-child(5) { width: 12%; }
  .doc-table-report-daily-attendance th:nth-child(6), .doc-table-report-daily-attendance td:nth-child(6) { width: 26%; }
  .doc-table-payroll th:nth-child(1), .doc-table-payroll td:nth-child(1) { width: 14%; }
  .doc-table-payroll th:nth-child(2), .doc-table-payroll td:nth-child(2) { width: 22%; }
  .doc-table-payroll th:nth-child(3), .doc-table-payroll td:nth-child(3) { width: 28%; }
  .doc-table-payroll th:nth-child(4), .doc-table-payroll td:nth-child(4) { width: 18%; }
  .doc-table-payroll th:nth-child(5), .doc-table-payroll td:nth-child(5) { width: 18%; }
  .doc-table-kv,
  .pdf-table-kv { width: 100%; border-collapse: collapse; margin: 10px 0 0; font-size: 10pt; table-layout: fixed; }
  .doc-table-kv th, .doc-table-kv td, .pdf-table-kv th, .pdf-table-kv td {
    border: 1px solid var(--pdf-border);
    padding: 7px 9px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
    text-shadow: none;
  }
  .doc-table-kv th, .pdf-table-kv th { width: 38%; background: var(--pdf-row-alt) !important; font-weight: 600; color: var(--pdf-text) !important; }
  .doc-table-kv td, .pdf-table-kv td { width: 62%; color: var(--pdf-text) !important; background: var(--pdf-white) !important; }
  .doc-table-totals, .doc-summary-table { max-width: 420px; margin-left: auto; }
  .doc-table .num { text-align: right; white-space: nowrap; }
  .doc-table thead { display: table-header-group; }
  .doc-table tbody tr { page-break-inside: avoid; }
  .doc-table-compact { font-size: 8.5pt; }
  .doc-table-compact th, .doc-table-compact td { padding: 5px 6px; }
  .doc-totals-panel { max-width: 420px; margin: 8px 0 0 auto; }
  .doc-subtitle { font-size: 10pt; color: #333333 !important; margin: 0 0 12px; }
  .doc-text { font-size: 10.5pt; line-height: 1.5; text-align: justify; hyphens: auto; }
  .doc-photo-block, .doc-photo-wrap {
    page-break-inside: avoid;
    margin: 10px 0 0;
    padding: 10px;
    border: 1px solid #d9e2ef;
    border-radius: 4px;
    background: #ffffff;
    text-align: center;
  }
  .doc-photo-block img, .doc-photo-wrap img { max-width: 100%; max-height: 280px; object-fit: contain; border: 1px solid #c5d0de; }
  .net-row th, .net-row td {
    font-weight: 700;
    background: var(--pdf-white) !important;
    color: #000000 !important;
    border-top: 3px solid var(--pdf-gold) !important;
    border-bottom: 2px solid var(--pdf-gold) !important;
    font-size: 11pt;
  }
  .profit { color: #059669; font-weight: 600; }
  .loss { color: #dc2626; font-weight: 600; }
  .doc-table-attendance { font-size: 7.5pt; }
  .doc-table-attendance th, .doc-table-attendance td { padding: 4px 5px; }
  .doc-table-attendance th:nth-child(1), .doc-table-attendance td:nth-child(1) { width: 9%; }
  .doc-table-attendance th:nth-child(2), .doc-table-attendance td:nth-child(2) { width: 12%; }
  .doc-table-attendance th:nth-child(3), .doc-table-attendance td:nth-child(3) { width: 11%; }
  .doc-table-attendance th:nth-child(4), .doc-table-attendance td:nth-child(4) { width: 7%; }
  .doc-table-attendance th:nth-child(5), .doc-table-attendance td:nth-child(5) { width: 7%; }
  .doc-table-attendance th:nth-child(6), .doc-table-attendance td:nth-child(6) { width: 7%; }
  .doc-table-attendance th:nth-child(7), .doc-table-attendance td:nth-child(7) { width: 9%; }
  .doc-table-attendance th:nth-child(8), .doc-table-attendance td:nth-child(8) { width: 9%; }
  .doc-table-attendance th:nth-child(9), .doc-table-attendance td:nth-child(9) { width: 14%; }
  .doc-table-attendance th:nth-child(10), .doc-table-attendance td:nth-child(10) { width: 15%; }
  .doc-table-profit { font-size: 7pt; }
  .doc-table-profit th, .doc-table-profit td { padding: 4px 4px; }
  .diary-photo-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 8px; }
  .diary-photo-item { page-break-inside: avoid; border: 1px solid #d9e2ef; border-radius: 4px; padding: 10px; background: #ffffff; }
  .diary-photo-item img.photo-main { max-height: 220px; width: 100%; object-fit: contain; border: 1px solid #ddd; }
  .diary-photo-item img.photo-map { max-height: 120px; width: 100%; object-fit: cover; border: 1px solid #ddd; margin-top: 8px; }
  .diary-photo-map-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .diary-photo-map-row img { max-height: 100px; width: 100%; object-fit: cover; border: 1px solid #ddd; }
  .diary-photo-meta { font-size: 9pt; color: #333333 !important; margin-top: 6px; line-height: 1.45; }
  .diary-workers, .diary-performances { white-space: pre-wrap; font-size: 10pt; line-height: 1.5; }
  .doc-note-box {
    margin-top: 10px;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    background: #f8fafc;
    font-size: 9pt;
    color: #333333 !important;
    line-height: 1.45;
  }
`

export function getProfessionalDocumentStyles(extra = ''): string {
  return `
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    html.pdf-document,
    body.pdf-document {
      font-family: ${PRINT_FONT_STACK};
      background: var(--pdf-white) !important;
      color: var(--pdf-text) !important;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      width: 210mm;
    }
    .pdf-document,
    .pdf-document .pdf-content,
    .pdf-document .doc-shell,
    .pdf-document .doc-section,
    .pdf-document p,
    .pdf-document span,
    .pdf-document td,
    .pdf-document li,
    .pdf-document label,
    .pdf-document div.doc-kv > div,
    .pdf-document .doc-text,
    .pdf-document .doc-note-box,
    .pdf-document .doc-sign-line,
    .pdf-document .doc-sign-role,
    .pdf-document .doc-footer,
    .pdf-document .doc-company-meta {
      color: var(--pdf-text) !important;
      text-shadow: none !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pdf-document .doc-table > thead > tr > th {
      color: #ffffff !important;
      background: var(--pdf-black) !important;
    }
    .pdf-document .doc-table-kv th,
    .pdf-document .doc-summary-table th,
    .pdf-document .net-row th {
      color: var(--pdf-text) !important;
      background: var(--pdf-row-alt) !important;
    }
    .pdf-document .doc-kv .k,
    .pdf-document .doc-meta-grid .label {
      color: var(--pdf-text-muted) !important;
    }
    .pdf-document .doc-company-name,
    .pdf-document .doc-title,
    .pdf-document .net-row th,
    .pdf-document .net-row td {
      color: #000000 !important;
    }
    .pdf-document .net-row th {
      background: var(--pdf-white) !important;
    }
    .doc-shell { width: 100%; max-width: 100%; margin: 0; display: flex; flex-direction: column; gap: 0; }
    .doc-header {
      display: grid;
      grid-template-columns: 22mm 1fr;
      gap: 12px;
      align-items: start;
      padding-bottom: 0;
      border-bottom: none;
      margin-bottom: 0;
      page-break-inside: avoid;
    }
    .doc-section-brand .doc-header { margin-bottom: 0; }
    .doc-company-name { margin: 0; font-size: 15pt; font-weight: 700; color: #000000 !important; }
    .doc-company-meta { margin: 3px 0 0; font-size: 9pt; color: var(--pdf-text-muted) !important; line-height: 1.35; }
    .doc-title-block { margin: 0; text-align: center; page-break-inside: avoid; }
    .doc-title { margin: 10px 0 0; font-size: 16pt; font-weight: 700; letter-spacing: 0.02em; color: #000000 !important; text-align: center; border-bottom: 2px solid var(--pdf-gold); padding-bottom: 6px; }
    .doc-meta-line { margin: 2px 0; font-size: 10pt; color: var(--pdf-text-muted) !important; }
    .doc-section {
      width: 100%;
      margin: 0 0 12px;
      padding: 10px 12px;
      border: 1px solid var(--pdf-border);
      border-radius: 4px;
      background: var(--pdf-white);
      page-break-inside: avoid;
      break-inside: avoid;
      color: var(--pdf-text) !important;
      position: relative;
      z-index: 1;
    }
    .doc-section:last-child { margin-bottom: 0; }
    .doc-section-title { text-align: center; background: #ffffff; }
    .doc-section-title .doc-title { margin: 0; }
    .doc-section-signatures .doc-signatures { margin-top: 0; }
    .doc-section:empty { display: none; }
    .doc-shell:empty { display: none; }
    .doc-section h2 {
      margin: -10px -12px 10px;
      padding: 7px 12px;
      font-size: 11pt;
      font-weight: 700;
      color: var(--pdf-gold) !important;
      background: var(--pdf-black) !important;
      border-bottom: 2px solid var(--pdf-gold);
    }
    .doc-section p, .doc-section li { margin: 0 0 8px; text-align: justify; hyphens: auto; }
    .doc-section ol, .doc-section ul { margin: 0 0 8px; padding-left: 20px; }
    .doc-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 12px 0 18px; }
    .doc-party {
      border: 1px solid #d9e2ef;
      border-radius: 4px;
      padding: 12px;
      background: #ffffff;
      page-break-inside: avoid;
    }
    .doc-party h3 {
      margin: 0 0 8px;
      font-size: 10.5pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #000000 !important;
    }
    .doc-party p { margin: 0 0 4px; font-size: 10pt; }
    .doc-kv,
    .diary-kv {
      display: grid;
      grid-template-columns: minmax(130px, 38%) 1fr;
      gap: 6px 14px;
      margin: 0;
      padding: 10px 12px;
      font-size: 10pt;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      background: #ffffff;
    }
    .doc-kv .k,
    .diary-kv .k { color: var(--pdf-text-muted) !important; font-weight: 600; }
    .doc-meta-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0;
      padding: 10px 12px;
      font-size: 10pt;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      background: #ffffff;
    }
    .doc-meta-grid > div {
      display: grid;
      grid-template-columns: minmax(130px, 38%) 1fr;
      gap: 6px 14px;
      padding: 4px 0;
      border-bottom: 1px solid #eef1f5;
    }
    .doc-meta-grid > div:last-child { border-bottom: none; }
    .doc-meta-grid .label { color: var(--pdf-text-muted) !important; font-weight: 600; }
    .doc-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 0; page-break-inside: avoid; break-inside: avoid; }
    .doc-sign-box { min-height: 100px; page-break-inside: avoid; break-inside: avoid; }
    .doc-sign-line { margin-top: 52px; border-top: 2px solid var(--pdf-gold); padding-top: 6px; font-size: 10pt; color: var(--pdf-text) !important; }
    .doc-sign-role { font-size: 9pt; color: var(--pdf-text-muted) !important; }
    .doc-sign-img { max-height: 80px; max-width: 100%; object-fit: contain; margin-bottom: 4px; }
    .signature-section, .summary-section { page-break-inside: avoid; break-inside: avoid; }
    .doc-footer {
      position: static;
      left: auto;
      right: auto;
      bottom: auto;
      margin-top: 14mm;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 8px;
      align-items: center;
      font-size: 8.5pt;
      color: var(--pdf-text-muted) !important;
      border-top: 2px solid var(--pdf-gold);
      padding-top: 6px;
      z-index: 2;
    }
    .doc-footer .page-num::after { content: counter(page) " / " counter(pages); }
    .doc-footer-center { text-align: center; }
    .doc-footer-right { text-align: right; }
    body.has-doc-footer { padding-bottom: 18mm; }
    @media print {
      html.pdf-document, body.pdf-document {
        padding: 0;
        margin: 0;
        background: var(--pdf-white) !important;
        color: var(--pdf-text) !important;
      }
      .pdf-page {
        width: 210mm;
        min-height: 297mm;
        overflow: hidden;
        height: auto;
        background: var(--pdf-white) !important;
        color: var(--pdf-text) !important;
        box-shadow: none;
      }
      .doc-footer { position: fixed; }
      .pdf-watermark-layer {
        opacity: 0.04 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      table, .summary-section, .signature-section, .doc-section-signatures {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      th, td, .net-row th, .net-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .doc-section:empty, .doc-photo-block:empty { display: none !important; }
      h1, h2, h3 { break-after: avoid-page; page-break-after: avoid; }
      p, li { orphans: 3; widows: 3; }
      .doc-table { width: 100%; table-layout: fixed; }
      .doc-table th, .doc-table td { overflow-wrap: anywhere; word-break: break-word; }
    }
    ${PDF_PAGE_CSS}
    ${PROFESSIONAL_TABLE_CSS}
    ${extra}
  `
}

/** @deprecated Používejte buildProfessionalReportDocument */
export function getPrintStyles(extra = ''): string {
  return getProfessionalDocumentStyles(extra)
}

export type CompanyHeader = Pick<
  CompanySettings,
  | 'company_name'
  | 'logo_url'
  | 'watermark_url'
  | 'tagline'
  | 'ico'
  | 'dic'
  | 'address'
  | 'city'
  | 'postal_code'
  | 'phone'
  | 'email'
  | 'website'
>

export function companySettingsToHeader(company: CompanySettings): CompanyHeader {
  return {
    company_name: company.company_name,
    logo_url: company.logo_url,
    watermark_url: company.watermark_url ?? '',
    tagline: company.tagline,
    ico: company.ico,
    dic: company.dic,
    address: company.address,
    city: company.city,
    postal_code: company.postal_code,
    phone: company.phone,
    email: company.email,
    website: company.website,
  }
}

export interface BuildPrintDocumentOptions {
  extraStyles?: string
  company?: CompanyHeader | null
  createdAt?: string
  includeStandardFooter?: boolean
}

export interface ProfessionalDocumentMeta {
  title: string
  documentNumber: string
  createdAt: string
  employeeName?: string
  periodLabel?: string
}

export interface ProfessionalReportOptions {
  title: string
  documentNumber?: string
  createdAt?: string
  extraStyles?: string
}

function normalizePrintOptions(options?: BuildPrintDocumentOptions | string): BuildPrintDocumentOptions {
  if (typeof options === 'string') return { extraStyles: options }
  return options ?? {}
}

export function formatDocumentCreatedAt(date = new Date()): string {
  return date.toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildDocumentNumber(prefix: string): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const safe =
    prefix
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24)
      .toUpperCase() || 'DOK'
  return `${safe}-${stamp}`
}

function resolveDefaultLogoUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const logo = DEFAULT_APP_LOGO_URL
  if (logo.startsWith('http')) return logo
  return `${origin}${logo.startsWith('/') ? logo : `/${logo}`}`
}

export function resolveCompanyHeader(company?: CompanyHeader | CompanySettings | null): CompanyHeader {
  if (!company) {
    return {
      company_name: 'VH Bulldig s.r.o.',
      logo_url: resolveDefaultLogoUrl(),
      watermark_url: '',
      tagline: 'Stavební a zemní práce',
      ico: '',
      dic: '',
      address: '',
      city: '',
      postal_code: '',
      phone: '',
      email: '',
      website: '',
    }
  }
  if ('bank_account' in company) {
    const header = companySettingsToHeader(company)
    if (!header.logo_url?.trim()) header.logo_url = resolveDefaultLogoUrl()
    return header
  }
  const header = { ...company }
  if (!header.logo_url?.trim()) header.logo_url = resolveDefaultLogoUrl()
  return header
}

export function buildCompanyContactLine(company: CompanyHeader): string {
  return [company.phone, company.email, company.website].filter(Boolean).join(' · ')
}

export function buildCompanyAddressLine(company: CompanyHeader): string {
  return [company.address, company.postal_code, company.city].filter(Boolean).join(', ')
}

export function buildDocumentWatermarkHtml(company?: CompanyHeader | null): string {
  const url = company?.watermark_url?.trim()
  const companyImg = url
    ? `<img src="${escHtml(url)}" alt="" class="pdf-watermark-company" aria-hidden="true" />`
    : ''
  return `<div class="pdf-watermark-layer" aria-hidden="true" style="${PDF_WATERMARK_LAYER_STYLE}">${ENGINEERING_WATERMARK_SVG}${companyImg}</div>`
}

/** @deprecated Používejte buildProfessionalDocumentHeader */
export function buildCompanyHeaderHtml(company?: CompanyHeader | null, documentTitle?: string): string {
  const co = resolveCompanyHeader(company)
  const meta: ProfessionalDocumentMeta = {
    title: documentTitle || co.company_name,
    documentNumber: buildDocumentNumber(documentTitle || 'DOK'),
    createdAt: formatDocumentCreatedAt(),
  }
  return buildProfessionalDocumentHeader(co, meta)
}

export function buildProfessionalDocumentHeader(
  company: CompanyHeader,
  meta: ProfessionalDocumentMeta
): string {
  const logoUrl = company.logo_url?.trim() || resolveDefaultLogoUrl()
  const logo = `<div class="pdf-logo-box"><img src="${escHtml(logoUrl)}" alt="Logo ${escHtml(company.company_name)}" class="pdf-company-logo" style="${PDF_LOGO_INLINE_STYLE}" /></div>`
  const address = buildCompanyAddressLine(company)
  const contact = buildCompanyContactLine(company)
  const ids = [company.ico ? `IČO: ${company.ico}` : '', company.dic ? `DIČ: ${company.dic}` : '']
    .filter(Boolean)
    .join(' · ')

  return `
    <section class="doc-section doc-section-brand">
      <header class="doc-header">
        ${logo}
        <div>
          <p class="doc-company-name">${escHtml(company.company_name)}</p>
          ${company.tagline ? `<p class="doc-company-meta">${escHtml(company.tagline)}</p>` : ''}
          ${address ? `<p class="doc-company-meta">${escHtml(address)}</p>` : ''}
          ${ids ? `<p class="doc-company-meta">${escHtml(ids)}</p>` : ''}
          ${company.email ? `<p class="doc-company-meta">${escHtml(company.email)}</p>` : ''}
          ${contact && !company.email ? `<p class="doc-company-meta">${escHtml(contact)}</p>` : ''}
        </div>
      </header>
      <h1 class="doc-title">${escHtml(meta.title)}</h1>
      <div class="doc-kv doc-kv-compact">
        <span class="k">Číslo dokumentu</span><span>${escHtml(meta.documentNumber)}</span>
        <span class="k">Datum vytvoření</span><span>${escHtml(meta.createdAt)}</span>
        ${meta.employeeName ? `<span class="k">Zaměstnanec</span><span>${escHtml(meta.employeeName)}</span>` : ''}
        ${meta.periodLabel ? `<span class="k">Období</span><span>${escHtml(meta.periodLabel)}</span>` : ''}
      </div>
    </section>
  `
}

export function buildProfessionalDocumentFooter(company: CompanyHeader, createdAt?: string): string {
  const dateLabel = createdAt ?? formatDocumentCreatedAt()
  const companyLabel = company.company_name || 'VH Bulldig s.r.o.'
  const year = new Date().getFullYear()

  return `
    <footer class="doc-footer">
      <span>${escHtml(companyLabel)} · ${escHtml(dateLabel)}</span>
      <span class="doc-footer-center">© ${year} VH Bulldig s.r.o.</span>
      <span class="doc-footer-right">Strana <span class="page-num"></span></span>
    </footer>
  `
}

export function buildDiaryStylePrintDocument(
  pageTitle: string,
  meta: ProfessionalDocumentMeta,
  bodyHtml: string,
  company?: CompanyHeader | CompanySettings | null,
  extraStyles?: string
): string {
  const co = resolveCompanyHeader(company)
  const createdAt = meta.createdAt ?? formatDocumentCreatedAt()
  const content = `${buildProfessionalDocumentHeader(co, meta)}${bodyHtml}${buildProfessionalDocumentFooter(co, createdAt)}`
  return buildProfessionalPrintDocument(pageTitle, content, { company: co, extraStyles })
}

export function buildProfessionalReportDocument(
  options: ProfessionalReportOptions,
  bodyHtml: string,
  company?: CompanyHeader | CompanySettings | null
): string {
  const co = resolveCompanyHeader(company)
  const createdAt = options.createdAt ?? formatDocumentCreatedAt()
  const documentNumber = options.documentNumber ?? buildDocumentNumber(options.title)
  const meta: ProfessionalDocumentMeta = {
    title: options.title,
    documentNumber,
    createdAt,
  }
  const content = `${buildProfessionalDocumentHeader(co, meta)}${bodyHtml}${buildProfessionalDocumentFooter(co, createdAt)}`
  return buildProfessionalPrintDocument(options.title, content, { company: co, extraStyles: options.extraStyles })
}

function wrapBodyContent(bodyHtml: string): string {
  if (bodyHtml.includes('doc-shell')) {
    return bodyHtml
  }
  return `<div class="doc-shell">${bodyHtml}</div>`
}

export function buildProfessionalPrintDocument(
  title: string,
  bodyHtml: string,
  options?: BuildPrintDocumentOptions | string
): string {
  const opts = normalizePrintOptions(options)
  const company = opts.company ? resolveCompanyHeader(opts.company) : undefined
  const watermark = buildDocumentWatermarkHtml(company)
  const bodyClass = watermark || bodyHtml.includes('doc-footer') ? ' class="pdf-document has-doc-footer"' : ' class="pdf-document"'

  return `<!DOCTYPE html>
<html lang="cs" class="pdf-document">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>${escHtml(title)}</title>
  ${PRINT_FONT_LINKS}
  <style>${getProfessionalDocumentStyles(opts.extraStyles ?? '')}</style>
</head>
<body${bodyClass} data-theme="light" data-pdf-export="true">
  <div class="pdf-page doc-page">
    ${watermark}
    <div class="pdf-content">
      ${wrapBodyContent(bodyHtml)}
    </div>
  </div>
</body>
</html>`
}

/** @deprecated Používejte buildProfessionalReportDocument */
export function buildPrintDocument(
  title: string,
  bodyHtml: string,
  options?: BuildPrintDocumentOptions | string
): string {
  const opts = normalizePrintOptions(options)
  return buildProfessionalReportDocument(
    { title, extraStyles: opts.extraStyles, createdAt: opts.createdAt },
    bodyHtml,
    opts.company
  )
}

export interface OpenPrintDocumentOptions {
  fileName?: string
  title?: string
  shareText?: string
}

export function openPrintDocument(html: string, options?: OpenPrintDocumentOptions): void {
  printProfessionalPdf(html, options)
}

export function openPreviewDocument(html: string): void {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
}

export function downloadHtmlDocument(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

import { DEFAULT_APP_LOGO_URL } from '@/constants/branding'
import type { CompanySettings } from '@/types'

export function escHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const PRINT_FONT_STACK =
  '"Noto Sans", "DejaVu Sans", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'

export const DOCUMENT_WATERMARK_OPACITY = 0.06

const PRINT_FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
`

const WATERMARK_PRINT_CSS = `
  .doc-watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    width: 175mm;
    max-height: 240mm;
    transform: translate(-50%, -50%);
    opacity: ${DOCUMENT_WATERMARK_OPACITY};
    pointer-events: none;
    z-index: 0;
    object-fit: contain;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-content { position: relative; z-index: 1; }
`

const PROFESSIONAL_TABLE_CSS = `
  .doc-table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 10pt; }
  .doc-table th, .doc-table td { border: 1px solid #c5d0de; padding: 7px 9px; text-align: left; vertical-align: top; word-break: break-word; }
  .doc-table th { background: #eef3f9; font-weight: 600; color: #1e3a5f; }
  .doc-table .num { text-align: right; white-space: nowrap; }
  .doc-table thead { display: table-header-group; }
  .doc-table tbody tr { page-break-inside: avoid; }
  .doc-table-compact { font-size: 8.5pt; }
  .doc-table-compact th, .doc-table-compact td { padding: 5px 6px; }
  .doc-subtitle { font-size: 10pt; color: #555; margin: 0 0 12px; }
  .doc-text { font-size: 10.5pt; line-height: 1.5; text-align: justify; hyphens: auto; }
  .doc-photo-block, .doc-photo-wrap { page-break-inside: avoid; margin: 14px 0; }
  .doc-photo-block img, .doc-photo-wrap img { max-width: 100%; max-height: 280px; object-fit: contain; border: 1px solid #c5d0de; }
  .net-row th, .net-row td { font-weight: bold; background: #f0f7ff; }
  .profit { color: #059669; font-weight: 600; }
  .loss { color: #dc2626; font-weight: 600; }
`

export function getProfessionalDocumentStyles(extra = ''): string {
  return `
    @page { size: A4; margin: 22mm 18mm 24mm 18mm; }
    * { box-sizing: border-box; }
    html, body {
      font-family: ${PRINT_FONT_STACK};
      color: #1a1a1a;
      margin: 0;
      font-size: 11pt;
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
    }
    .doc-shell { max-width: 174mm; margin: 0 auto; }
    .doc-header {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 16px;
      align-items: start;
      padding-bottom: 12px;
      border-bottom: 2px solid #1e3a5f;
      margin-bottom: 18px;
    }
    .doc-logo { max-height: 72px; max-width: 180px; object-fit: contain; }
    .doc-company-name { margin: 0; font-size: 16pt; font-weight: 700; color: #1e3a5f; }
    .doc-company-meta { margin: 4px 0 0; font-size: 9.5pt; color: #444; line-height: 1.4; }
    .doc-title-block { margin: 0 0 18px; text-align: center; }
    .doc-title { margin: 0 0 6px; font-size: 17pt; font-weight: 700; letter-spacing: 0.02em; color: #1e3a5f; }
    .doc-meta-line { margin: 2px 0; font-size: 10pt; color: #555; }
    .doc-section { margin: 16px 0; page-break-inside: avoid; }
    .doc-section h2 {
      margin: 0 0 8px;
      font-size: 12pt;
      font-weight: 700;
      color: #1e3a5f;
      border-bottom: 1px solid #d9e2ef;
      padding-bottom: 4px;
    }
    .doc-section p, .doc-section li { margin: 0 0 8px; text-align: justify; hyphens: auto; }
    .doc-section ol, .doc-section ul { margin: 0 0 8px; padding-left: 20px; }
    .doc-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 12px 0 18px; }
    .doc-party {
      border: 1px solid #d9e2ef;
      border-radius: 4px;
      padding: 12px;
      background: #fafbfd;
      page-break-inside: avoid;
    }
    .doc-party h3 {
      margin: 0 0 8px;
      font-size: 10.5pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #1e3a5f;
    }
    .doc-party p { margin: 0 0 4px; font-size: 10pt; }
    .doc-kv { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; margin: 8px 0; font-size: 10pt; }
    .doc-kv .k { color: #666; }
    .doc-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 8px 0 16px; font-size: 10pt; }
    .doc-meta-grid .label { color: #666; }
    .doc-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; page-break-inside: avoid; }
    .doc-sign-box { min-height: 90px; }
    .doc-sign-line { margin-top: 48px; border-top: 1px solid #333; padding-top: 6px; font-size: 10pt; }
    .doc-sign-role { font-size: 9pt; color: #666; }
    .doc-footer {
      position: fixed;
      left: 18mm;
      right: 18mm;
      bottom: 10mm;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 8px;
      align-items: center;
      font-size: 8.5pt;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 6px;
      z-index: 2;
    }
    .doc-footer .page-num::after { content: counter(page) " / " counter(pages); }
    .doc-footer-center { text-align: center; }
    .doc-footer-right { text-align: right; }
    body.has-doc-footer { padding-bottom: 18mm; }
    @media print {
      body { padding: 0; }
      .doc-footer { position: fixed; }
      th, td, .net-row th, .net-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    ${WATERMARK_PRINT_CSS}
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
  if (!url) return ''
  return `<img src="${escHtml(url)}" alt="" class="doc-watermark" aria-hidden="true" />`
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
  const logo = `<img src="${escHtml(logoUrl)}" alt="Logo ${escHtml(company.company_name)}" class="doc-logo" />`
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
    return bodyHtml.replace('class="doc-shell"', 'class="doc-shell doc-content"')
  }
  return `<div class="doc-shell doc-content">${bodyHtml}</div>`
}

export function buildProfessionalPrintDocument(
  title: string,
  bodyHtml: string,
  options?: BuildPrintDocumentOptions | string
): string {
  const opts = normalizePrintOptions(options)
  const company = opts.company ? resolveCompanyHeader(opts.company) : undefined
  const watermark = buildDocumentWatermarkHtml(company)
  const bodyClass = watermark || bodyHtml.includes('doc-footer') ? ' class="has-doc-footer"' : ''

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)}</title>
  ${PRINT_FONT_LINKS}
  <style>${getProfessionalDocumentStyles(opts.extraStyles ?? '')}</style>
</head>
<body${bodyClass}>
  ${watermark}
  ${wrapBodyContent(bodyHtml)}
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

export function openPrintDocument(html: string): void {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
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

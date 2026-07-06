import type { CompanySettings } from '@/types'

export function escHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const PRINT_FONT_STACK =
  '"Segoe UI", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'

export function getPrintStyles(extra = ''): string {
  return `
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: ${PRINT_FONT_STACK}; color: #111; margin: 0; }
    .report { max-width: 180mm; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 20px 0 8px; }
    .subtitle { color: #666; margin-bottom: 8px; font-size: 13px; }
    .footer { margin-top: 24px; font-size: 11px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
    th { background: #f5f5f5; }
    thead { display: table-header-group; }
    tbody tr { page-break-inside: avoid; }
    .num { text-align: right; white-space: nowrap; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-top: 12px; }
    .meta div { font-size: 13px; }
    .label { color: #666; }
    .header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
    .logo { max-height: 64px; max-width: 160px; object-fit: contain; }
    .text-block { font-size: 13px; line-height: 1.5; }
    .photo-block, .photo-wrap { page-break-inside: avoid; margin: 16px 0; }
    .photo-block img, .photo-wrap img { max-width: 100%; max-height: 280px; object-fit: contain; border: 1px solid #ddd; }
    .net-row th, .net-row td { font-weight: bold; background: #f0f7ff; }
    th, td, .net-row th, .net-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    a { color: #1a56db; word-break: break-all; }
    .profit { color: #059669; font-weight: 600; }
    .loss { color: #dc2626; font-weight: 600; }
    @media print { body { padding: 0; } }
    ${extra}
  `
}

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
    .doc-title { margin: 0 0 6px; font-size: 17pt; font-weight: 700; letter-spacing: 0.02em; }
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
    .doc-section p, .doc-section li { margin: 0 0 8px; text-align: justify; }
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
    .doc-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; page-break-inside: avoid; }
    .doc-sign-box { min-height: 90px; }
    .doc-sign-line { margin-top: 48px; border-top: 1px solid #333; padding-top: 6px; font-size: 10pt; }
    .doc-sign-role { font-size: 9pt; color: #666; }
    .doc-footer {
      position: fixed;
      left: 18mm;
      right: 18mm;
      bottom: 10mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5pt;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 6px;
    }
    .doc-footer .page-num::after { content: counter(page) " / " counter(pages); }
    @media print { body { padding: 0; } .doc-footer { position: fixed; } }
    ${extra}
  `
}

export type CompanyHeader = Pick<
  CompanySettings,
  'company_name' | 'logo_url' | 'tagline' | 'ico' | 'dic' | 'address' | 'city' | 'postal_code' | 'phone' | 'email' | 'website'
>

export function buildCompanyContactLine(company: CompanyHeader): string {
  return [company.phone, company.email, company.website].filter(Boolean).join(' · ')
}

export function buildCompanyAddressLine(company: CompanyHeader): string {
  return [company.address, company.postal_code, company.city].filter(Boolean).join(', ')
}

export function buildCompanyHeaderHtml(company?: CompanyHeader | null, documentTitle?: string): string {
  const title = documentTitle ? `<h1>${escHtml(documentTitle)}</h1>` : ''
  if (!company?.company_name && !company?.logo_url) {
    return title ? `<header class="header"><div>${title}</div></header>` : ''
  }

  const logo = company?.logo_url
    ? `<img src="${escHtml(company.logo_url)}" alt="Logo společnosti" class="logo" />`
    : ''
  const address = company ? buildCompanyAddressLine(company) : ''
  const ids = company
    ? [company.ico ? `IČO: ${company.ico}` : '', company.dic ? `DIČ: ${company.dic}` : ''].filter(Boolean).join(' · ')
    : ''
  const contact = company ? buildCompanyContactLine(company) : ''
  const companyName = company?.company_name ?? 'VH Bulldig s.r.o.'

  return `
    <header class="header">
      ${logo}
      <div>
        ${title || `<h1>${escHtml(companyName)}</h1>`}
        ${company?.tagline ? `<p class="subtitle">${escHtml(company.tagline)}</p>` : ''}
        ${address ? `<p class="subtitle">${escHtml(address)}</p>` : ''}
        ${ids ? `<p class="subtitle">${escHtml(ids)}</p>` : ''}
        ${contact ? `<p class="subtitle">${escHtml(contact)}</p>` : ''}
      </div>
    </header>
  `
}

export interface ProfessionalDocumentMeta {
  title: string
  documentNumber: string
  createdAt: string
}

export function buildProfessionalDocumentHeader(
  company: CompanyHeader,
  meta: ProfessionalDocumentMeta
): string {
  const logo = company.logo_url
    ? `<img src="${escHtml(company.logo_url)}" alt="Logo ${escHtml(company.company_name)}" class="doc-logo" />`
    : '<div class="doc-logo"></div>'

  const address = buildCompanyAddressLine(company)
  const contact = buildCompanyContactLine(company)
  const ids = [company.ico ? `IČO: ${company.ico}` : '', company.dic ? `DIČ: ${company.dic}` : ''].filter(Boolean).join(' · ')

  return `
    <header class="doc-header">
      ${logo}
      <div>
        <p class="doc-company-name">${escHtml(company.company_name)}</p>
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

export function buildProfessionalDocumentFooter(company: CompanyHeader): string {
  const footerLeft = [company.company_name, company.ico ? `IČO: ${company.ico}` : '', company.website || company.email]
    .filter(Boolean)
    .join(' | ')

  return `
    <footer class="doc-footer">
      <span>${escHtml(footerLeft)}</span>
      <span>Strana <span class="page-num"></span></span>
    </footer>
  `
}

export function buildPrintDocument(title: string, bodyHtml: string, extraStyles = ''): string {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <title>${escHtml(title)}</title>
  <style>${getPrintStyles(extraStyles)}</style>
</head>
<body>${bodyHtml}</body>
</html>`
}

export function buildProfessionalPrintDocument(title: string, bodyHtml: string, extraStyles = ''): string {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <title>${escHtml(title)}</title>
  <style>${getProfessionalDocumentStyles(extraStyles)}</style>
</head>
<body><div class="doc-shell">${bodyHtml}</div></body>
</html>`
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

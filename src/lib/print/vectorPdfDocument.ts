import { jsPDF, GState } from 'jspdf'
import {
  buildCompanyAddressLine,
  buildCompanyContactLine,
  formatDocumentCreatedAt,
  resolveCompanyHeader,
  type CompanyHeader,
} from '@/lib/print/printDocument'
import { ensurePdfFonts, FONT_FAMILY } from '@/lib/print/pdfFont'
import {
  extractPdfWatermarkConfig,
  normalizeWatermarkSizePercent,
  opacityPercentToCss,
} from '@/lib/print/watermark'

export const PDF_PAGE = { width: 210, height: 297 }
export const PDF_MARGIN = { top: 20, right: 18, bottom: 20, left: 18 }
export const PDF_CONTENT_WIDTH = PDF_PAGE.width - PDF_MARGIN.left - PDF_MARGIN.right
const FOOTER_RESERVE = 12
const PAGE_BOTTOM = PDF_PAGE.height - PDF_MARGIN.bottom - FOOTER_RESERVE

const COLOR_PRIMARY: [number, number, number] = [30, 58, 95]
const COLOR_MUTED: [number, number, number] = [102, 102, 102]
const COLOR_BORDER: [number, number, number] = [208, 225, 233]
const COLOR_HEADER_BG: [number, number, number] = [232, 241, 245]

export interface PdfDocumentMeta {
  title: string
  documentNumber: string
  createdAt?: string
}

export interface PdfTableColumn {
  header: string
  widthRatio: number
  align?: 'left' | 'right' | 'center'
}

function resolveAbsoluteAssetUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  const absolute = resolveAbsoluteAssetUrl(url)
  if (!absolute) return null
  if (absolute.startsWith('data:')) return absolute

  try {
    const res = await fetch(absolute, { credentials: 'same-origin' })
    if (res.ok) {
      const blob = await res.blob()
      return await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    }
  } catch {
    // fallback below
  }

  return new Promise((resolve) => {
    const img = new Image()
    if (!absolute.startsWith(window.location.origin) && !absolute.startsWith('/')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = absolute
  })
}

function clampPdfWatermarkOpacity(opacityPercent: number): number {
  const raw = opacityPercentToCss(opacityPercent)
  return Math.max(0.05, Math.min(0.1, raw))
}

export class VectorPdfDocument {
  readonly doc: jsPDF
  readonly company: CompanyHeader
  readonly createdAt: string
  private y = PDF_MARGIN.top
  private watermarkDataUrl: string | null = null
  private watermarkOpacity = 0.07
  private watermarkSizePercent = 65
  private logoDataUrl: string | null = null

  constructor(company?: CompanyHeader | null) {
    this.company = resolveCompanyHeader(company)
    this.createdAt = formatDocumentCreatedAt()
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  }

  async prepare(): Promise<void> {
    await ensurePdfFonts(this.doc)

    const wm = extractPdfWatermarkConfig(this.company)
    if (wm?.url) {
      this.watermarkSizePercent = normalizeWatermarkSizePercent(wm.sizePercent)
      this.watermarkOpacity = clampPdfWatermarkOpacity(wm.opacityPercent)
      this.watermarkDataUrl = await loadImageDataUrl(wm.url)
    }

    if (this.company.logo_url?.trim()) {
      this.logoDataUrl = await loadImageDataUrl(this.company.logo_url)
    }

    this.drawWatermark()
  }

  get cursorY(): number {
    return this.y
  }

  set cursorY(value: number) {
    this.y = value
  }

  private drawWatermark(): void {
    if (!this.watermarkDataUrl) return
    const wmWidth = PDF_PAGE.width * (this.watermarkSizePercent / 100)
    const wmHeight = wmWidth * 0.88
    const x = (PDF_PAGE.width - wmWidth) / 2
    const yPos = (PDF_PAGE.height - wmHeight) / 2
    const gState = new GState({ opacity: this.watermarkOpacity })
    this.doc.setGState(gState)
    this.doc.addImage(this.watermarkDataUrl, 'PNG', x, yPos, wmWidth, wmHeight, undefined, 'FAST')
    this.doc.setGState(new GState({ opacity: 1 }))
  }

  ensureSpace(heightMm: number): void {
    if (this.y + heightMm <= PAGE_BOTTOM) return
    this.addPage()
  }

  addPage(): void {
    this.doc.addPage()
    this.y = PDF_MARGIN.top
    this.drawWatermark()
  }

  drawCompanyHeader(meta: PdfDocumentMeta): void {
    const logoWidth = 32
    const logoHeight = 14
    let textX = PDF_MARGIN.left

    if (this.logoDataUrl) {
      try {
        this.doc.addImage(this.logoDataUrl, 'PNG', PDF_MARGIN.left, this.y, logoWidth, logoHeight, undefined, 'FAST')
        textX = PDF_MARGIN.left + logoWidth + 4
      } catch {
        textX = PDF_MARGIN.left
      }
    }

    this.doc.setFont(FONT_FAMILY, 'bold')
    this.doc.setFontSize(13)
    this.doc.setTextColor(...COLOR_PRIMARY)
    this.doc.text(this.company.company_name, textX, this.y + 5)

    this.doc.setFont(FONT_FAMILY, 'normal')
    this.doc.setFontSize(8)
    this.doc.setTextColor(...COLOR_MUTED)

    const metaLines = [
      this.company.tagline,
      buildCompanyAddressLine(this.company),
      [this.company.ico ? `IČO: ${this.company.ico}` : '', this.company.dic ? `DIČ: ${this.company.dic}` : '']
        .filter(Boolean)
        .join(' · '),
      buildCompanyContactLine(this.company),
    ].filter((line) => line && line.trim())

    let metaY = this.y + 9
    for (const line of metaLines) {
      this.doc.text(line, textX, metaY)
      metaY += 3.6
    }

    this.y = Math.max(this.y + logoHeight + 2, metaY + 2)

    this.doc.setDrawColor(...COLOR_BORDER)
    this.doc.setLineWidth(0.2)
    this.doc.line(PDF_MARGIN.left, this.y, PDF_PAGE.width - PDF_MARGIN.right, this.y)
    this.y += 6

    this.doc.setFont(FONT_FAMILY, 'bold')
    this.doc.setFontSize(15)
    this.doc.setTextColor(...COLOR_PRIMARY)
    this.doc.text(meta.title, PDF_PAGE.width / 2, this.y, { align: 'center' })
    this.y += 6

    this.doc.setFont(FONT_FAMILY, 'normal')
    this.doc.setFontSize(9)
    this.doc.setTextColor(...COLOR_MUTED)
    this.doc.text(`Číslo dokladu: ${meta.documentNumber}`, PDF_PAGE.width / 2, this.y, { align: 'center' })
    this.y += 4
    this.doc.text(`Vytvořeno: ${meta.createdAt ?? this.createdAt}`, PDF_PAGE.width / 2, this.y, { align: 'center' })
    this.y += 8
  }

  drawSectionTitle(title: string): void {
    this.ensureSpace(10)
    this.doc.setFont(FONT_FAMILY, 'bold')
    this.doc.setFontSize(11)
    this.doc.setTextColor(...COLOR_PRIMARY)
    this.doc.text(title, PDF_MARGIN.left, this.y)
    this.y += 6
  }

  drawKeyValueRows(rows: Array<{ label: string; value: string }>): void {
    const labelWidth = 44
    const valueWidth = PDF_CONTENT_WIDTH - labelWidth
    const lineHeight = 4.2

    for (const row of rows) {
      if (!row.value?.trim()) continue
      this.doc.setFont(FONT_FAMILY, 'bold')
      this.doc.setFontSize(9)
      this.doc.setTextColor(...COLOR_PRIMARY)
      const valueLines = this.doc.splitTextToSize(row.value, valueWidth) as string[]
      const blockHeight = Math.max(lineHeight, valueLines.length * lineHeight) + 1
      this.ensureSpace(blockHeight)

      this.doc.text(row.label, PDF_MARGIN.left, this.y)
      this.doc.setFont(FONT_FAMILY, 'normal')
      this.doc.setTextColor(26, 26, 26)
      this.doc.text(valueLines, PDF_MARGIN.left + labelWidth, this.y)
      this.y += blockHeight
    }
    this.y += 2
  }

  drawTwoColumnMeta(rows: Array<{ label: string; value: string }>): void {
    const colWidth = PDF_CONTENT_WIDTH / 2 - 4
    const lineHeight = 4
    let rowIndex = 0

    while (rowIndex < rows.length) {
      const left = rows[rowIndex]
      const right = rows[rowIndex + 1]
      if (!left?.value?.trim()) {
        rowIndex += right ? 2 : 1
        continue
      }

      const leftLines = this.doc.splitTextToSize(`${left.label}: ${left.value}`, colWidth) as string[]
      const rightLines = right?.value?.trim()
        ? (this.doc.splitTextToSize(`${right.label}: ${right.value}`, colWidth) as string[])
        : []
      const blockHeight = Math.max(leftLines.length, rightLines.length) * lineHeight + 2
      this.ensureSpace(blockHeight)

      this.doc.setFont(FONT_FAMILY, 'normal')
      this.doc.setFontSize(9)
      this.doc.setTextColor(26, 26, 26)
      this.doc.text(leftLines, PDF_MARGIN.left, this.y)
      if (rightLines.length > 0) {
        this.doc.text(rightLines, PDF_MARGIN.left + PDF_CONTENT_WIDTH / 2 + 2, this.y)
      }
      this.y += blockHeight
      rowIndex += right ? 2 : 1
    }
    this.y += 2
  }

  drawTable(columns: PdfTableColumn[], rows: string[][]): void {
    if (rows.length === 0) return

    const widths = columns.map((col) => col.widthRatio * PDF_CONTENT_WIDTH)
    const padding = 2
    const fontSize = 9
    const lineHeight = 3.8
    this.doc.setFontSize(fontSize)

    const drawHeader = () => {
      this.ensureSpace(lineHeight + padding * 2 + 2)
      let x = PDF_MARGIN.left
      const headerHeight = lineHeight + padding * 2
      this.doc.setFillColor(...COLOR_HEADER_BG)
      this.doc.rect(PDF_MARGIN.left, this.y - lineHeight - padding + 1, PDF_CONTENT_WIDTH, headerHeight, 'F')
      this.doc.setDrawColor(...COLOR_BORDER)
      this.doc.rect(PDF_MARGIN.left, this.y - lineHeight - padding + 1, PDF_CONTENT_WIDTH, headerHeight)

      this.doc.setFont(FONT_FAMILY, 'bold')
      this.doc.setTextColor(...COLOR_PRIMARY)
      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i]!
        const w = widths[i]!
        this.doc.text(col.header, x + padding, this.y, {
          align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
          maxWidth: w - padding * 2,
        })
        if (i < columns.length - 1) {
          this.doc.line(x + w, this.y - lineHeight - padding + 1, x + w, this.y - lineHeight - padding + 1 + headerHeight)
        }
        x += w
      }
      this.y += padding + 1
    }

    drawHeader()

    this.doc.setFont(FONT_FAMILY, 'normal')
    this.doc.setTextColor(26, 26, 26)

    for (const row of rows) {
      const cellLines = row.map((cell, index) => {
        const w = widths[index]!
        return this.doc.splitTextToSize(cell ?? '—', w - padding * 2) as string[]
      })
      const rowLineCount = Math.max(...cellLines.map((lines) => lines.length), 1)
      const rowHeight = rowLineCount * lineHeight + padding * 2

      if (this.y + rowHeight > PAGE_BOTTOM) {
        this.addPage()
        drawHeader()
        this.doc.setFont(FONT_FAMILY, 'normal')
        this.doc.setTextColor(26, 26, 26)
      }

      const rowTop = this.y - lineHeight + 1
      this.doc.setDrawColor(...COLOR_BORDER)
      this.doc.rect(PDF_MARGIN.left, rowTop, PDF_CONTENT_WIDTH, rowHeight)

      let x = PDF_MARGIN.left
      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i]!
        const w = widths[i]!
        const lines = cellLines[i] ?? ['—']
        this.doc.text(lines, x + padding, this.y, {
          align: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
          maxWidth: w - padding * 2,
        })
        if (i < columns.length - 1) {
          this.doc.line(x + w, rowTop, x + w, rowTop + rowHeight)
        }
        x += w
      }
      this.y += rowHeight - lineHeight + padding
    }
    this.y += 4
  }

  drawParagraph(text: string, options?: { fontSize?: number; color?: [number, number, number] }): void {
    const fontSize = options?.fontSize ?? 8.5
    const color = options?.color ?? COLOR_MUTED
    this.doc.setFont(FONT_FAMILY, 'normal')
    this.doc.setFontSize(fontSize)
    this.doc.setTextColor(...color)
    const lines = this.doc.splitTextToSize(text, PDF_CONTENT_WIDTH) as string[]
    const blockHeight = lines.length * 3.6 + 2
    this.ensureSpace(blockHeight)
    this.doc.text(lines, PDF_MARGIN.left, this.y)
    this.y += blockHeight
  }

  async drawImageBlock(title: string, url: string, maxHeightMm: number): Promise<void> {
    this.drawSectionTitle(title)
    await this.drawImage(url, maxHeightMm)
  }

  async drawImage(url: string, maxHeightMm: number): Promise<void> {
    const dataUrl = await loadImageDataUrl(url)
    if (!dataUrl) return

    const maxWidth = PDF_CONTENT_WIDTH
    const imgHeight = Math.min(maxHeightMm, maxWidth * 0.55)
    this.ensureSpace(imgHeight + 4)
    try {
      this.doc.addImage(dataUrl, 'PNG', PDF_MARGIN.left, this.y, maxWidth, imgHeight, undefined, 'FAST')
      this.y += imgHeight + 6
    } catch {
      // skip broken image
    }
  }

  drawFootersOnAllPages(): void {
    const total = this.doc.getNumberOfPages()
    const year = new Date().getFullYear()
    const footerY = PDF_PAGE.height - PDF_MARGIN.bottom + 2
    const lineY = footerY - 4

    for (let page = 1; page <= total; page += 1) {
      this.doc.setPage(page)
      this.doc.setDrawColor(...COLOR_BORDER)
      this.doc.setLineWidth(0.2)
      this.doc.line(PDF_MARGIN.left, lineY, PDF_PAGE.width - PDF_MARGIN.right, lineY)
      this.doc.setFont(FONT_FAMILY, 'normal')
      this.doc.setFontSize(7.5)
      this.doc.setTextColor(91, 107, 124)
      this.doc.text(`${this.company.company_name} · ${this.createdAt}`, PDF_MARGIN.left, footerY)
      this.doc.text(`© ${year} VH Bulldig s.r.o.`, PDF_PAGE.width / 2, footerY, { align: 'center' })
      this.doc.text(`Strana ${page} / ${total}`, PDF_PAGE.width - PDF_MARGIN.right, footerY, { align: 'right' })
    }
  }

  toBlob(): Blob {
    this.drawFootersOnAllPages()
    const blob = this.doc.output('blob')
    return blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' })
  }
}

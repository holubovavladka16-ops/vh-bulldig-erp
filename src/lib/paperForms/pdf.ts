import { jsPDF } from 'jspdf'
import { DEFAULT_APP_LOGO_URL } from '@/constants/branding'
import { EMPLOYMENT_TYPE_LABELS } from '@/constants/workers'
import { MONTH_NAMES } from '@/constants/paperForms'
import { formatDateCz } from '@/lib/dates'
import { ensurePdfFonts, FONT_FAMILY } from '@/lib/print/pdfFont'
import { assertValidPdfBlob } from '@/lib/print/pdfShare'
import type { CompanySettings } from '@/types'
import type { EmploymentType } from '@/types/workers'
import type { PaperFormLine, PaperMonthlyForm, PaperWorkerSnapshot } from '@/types/paperForms'

function snapshotText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function snapshotDate(value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return formatDateCz(value) || value.trim()
}

function snapshotEmployment(value: string | null | undefined): string {
  if (!value?.trim()) return ''
  const key = value.trim() as EmploymentType
  return EMPLOYMENT_TYPE_LABELS[key] ?? value.trim()
}

function paperWorkerInfoRows(form: PaperMonthlyForm, ws: PaperWorkerSnapshot | null): Array<[string, string]> {
  return [
    ['Jméno', snapshotText(ws?.first_name)],
    ['Příjmení', snapshotText(ws?.last_name)],
    ['Datum narození', snapshotDate(ws?.birth_date)],
    ['Adresa', snapshotText(ws?.address)],
    ['Datum nástupu', snapshotDate(ws?.start_date)],
    ['Pozice', snapshotText(ws?.position)],
    ['Pracovní poměr', snapshotEmployment(ws?.employment_type)],
    ['Měsíc', MONTH_NAMES[form.month - 1] ?? String(form.month)],
    ['Rok', String(form.year)],
  ]
}

const PAGE_W = 210
const PAGE_H = 297
const M = { top: 7, right: 7, bottom: 7, left: 7 }
const CONTENT_W = PAGE_W - M.left - M.right

const GOLD: [number, number, number] = [184, 148, 58]
const GOLD_LIGHT: [number, number, number] = [245, 236, 210]
const INK: [number, number, number] = [26, 26, 26]
const MUTED: [number, number, number] = [90, 90, 90]

const DAY_NAMES = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']
const QR_SIZE = 20

/** Sloupce dle finální specifikace — pouze těchto 10, nic navíc */
export const PAPER_FORM_TABLE_COLUMNS = [
  { key: 'den', label: 'Den', w: 5 },
  { key: 'datum', label: 'Datum', w: 11 },
  { key: 'zakazka', label: 'Zakázka', w: 71 },
  { key: 'od', label: 'Od', w: 7 },
  { key: 'do', label: 'Do', w: 7 },
  { key: 'hodiny', label: 'Celkem\nhodin', w: 15 },
  { key: 'vykop', label: 'Ruční výkop\nhloubka 50–70 cm\n(bm)', w: 15 },
  { key: 'pruraz', label: 'Průraz do\nobjektu (ks)', w: 15 },
  { key: 'zaloha', label: 'Záloha\n(Kč)', w: 20 },
  { key: 'podpis', label: 'Podpis', w: 30 },
] as const

const TABLE_WIDTH = PAPER_FORM_TABLE_COLUMNS.reduce((sum, col) => sum + col.w, 0)
if (TABLE_WIDTH !== CONTENT_W) {
  throw new Error(`PAPER_FORM_TABLE_COLUMNS must sum to ${CONTENT_W}mm, got ${TABLE_WIDTH}mm`)
}

const TABLE_COLUMNS = PAPER_FORM_TABLE_COLUMNS

async function loadImageDataUrl(url: string): Promise<string | null> {
  const trimmed = url.trim()
  if (!trimmed) return null
  const absolute = trimmed.startsWith('http') || trimmed.startsWith('data:')
    ? trimmed
    : `${typeof window !== 'undefined' ? window.location.origin : ''}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`
  try {
    const res = await fetch(absolute, { credentials: 'same-origin' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function loadQrDataUrl(formId: string): Promise<string | null> {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(formId)}&bgcolor=ffffff&color=000000&margin=0`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function drawRegistrationMarks(doc: jsPDF) {
  const len = 10
  const inset = 3
  doc.setDrawColor(0)
  doc.setLineWidth(0.45)
  const pts: Array<[number, number, number, number]> = [
    [inset, inset, 1, 1],
    [PAGE_W - inset, inset, -1, 1],
    [inset, PAGE_H - inset, 1, -1],
    [PAGE_W - inset, PAGE_H - inset, -1, -1],
  ]
  for (const [x, y, dx, dy] of pts) {
    doc.line(x, y, x + dx * len, y)
    doc.line(x, y, x, y + dy * len)
  }
}

function drawCell(doc: jsPDF, x: number, y: number, w: number, h: number, fill?: [number, number, number]) {
  if (fill) {
    doc.setFillColor(...fill)
    doc.rect(x, y, w, h, 'FD')
  } else {
    doc.setDrawColor(40)
    doc.setLineWidth(0.18)
    doc.rect(x, y, w, h)
  }
}

function drawMultilineHeader(doc: jsPDF, text: string, x: number, y: number, w: number) {
  const lines = text.split('\n')
  doc.setFontSize(lines.length >= 3 ? 4.6 : 5.2)
  const lineGap = lines.length >= 3 ? 2.1 : 2.2
  const startY = y + (lines.length === 1 ? 3.4 : lines.length === 2 ? 2.6 : 2.2)
  lines.forEach((line, i) => {
    doc.text(line, x + w / 2, startY + i * lineGap, { align: 'center' })
  })
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

function buildMonthRows(form: PaperMonthlyForm, lines: PaperFormLine[]) {
  const maxDays = daysInMonth(form.month, form.year)
  const byDay = new Map<number, PaperFormLine>()
  for (const line of lines.filter((l) => l.line_role === 'attendance_primary')) {
    const d = new Date(line.form_date)
    if (d.getMonth() + 1 === form.month && d.getFullYear() === form.year) {
      byDay.set(d.getDate(), line)
    }
  }

  return Array.from({ length: 31 }, (_, i) => {
    const dayNum = i + 1
    if (dayNum > maxDays) {
      return { dayNum, valid: false, line: null as PaperFormLine | null }
    }
    const date = new Date(form.year, form.month - 1, dayNum)
    return {
      dayNum,
      valid: true,
      dayName: DAY_NAMES[date.getDay()] ?? '',
      dateStr: `${dayNum}. ${form.month}.`,
      line: byDay.get(dayNum) ?? null,
    }
  })
}

export async function drawPaperMonthlyFormPage(
  doc: jsPDF,
  form: PaperMonthlyForm,
  lines: PaperFormLine[],
  company: CompanySettings
): Promise<void> {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  drawRegistrationMarks(doc)

  const logoUrl = company.logo_url?.trim() || DEFAULT_APP_LOGO_URL
  const logo = await loadImageDataUrl(logoUrl)
  const headerTop = M.top + 2

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', M.left, headerTop, 22, 9)
    } catch {
      /* optional */
    }
  }

  doc.setFont(FONT_FAMILY, 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  doc.text('VH BULLDIG ERP', M.left + (logo ? 24 : 0), headerTop + 3.5)

  doc.setFontSize(13)
  doc.setTextColor(...GOLD)
  doc.text('MĚSÍČNÍ PRACOVNÍ VÝKAZ', M.left, headerTop + 11)

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(M.left, headerTop + 13, M.left + 92, headerTop + 13)

  const ws = form.worker_snapshot
  const infoX = M.left
  const infoY = headerTop + 17
  doc.setFontSize(7)

  const infoRows = paperWorkerInfoRows(form, ws)

  const colSplit = infoX + 46
  doc.setFont(FONT_FAMILY, 'normal')
  for (let i = 0; i < infoRows.length; i++) {
    const [label, value] = infoRows[i]!
    const x = i < 5 ? infoX : colSplit
    const y = i < 5 ? infoY + i * 3.6 : infoY + (i - 5) * 3.6
    doc.setTextColor(...MUTED)
    doc.text(`${label}:`, x, y)
    doc.setTextColor(...INK)
    doc.text(value || '________________', x + 22, y)
  }

  doc.setFont(FONT_FAMILY, 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...INK)
  doc.text(`ID: ${form.form_number}`, colSplit + 22, infoY + 14)

  const footerH = 26
  const qrZoneH = QR_SIZE + 4
  const tableTop = headerTop + 36
  const tableBottom = PAGE_H - M.bottom - footerH - qrZoneH
  const headerRowH = 6.2
  const rowH = (tableBottom - tableTop - headerRowH) / 31

  let x = M.left
  doc.setFont(FONT_FAMILY, 'bold')
  for (const col of TABLE_COLUMNS) {
    drawCell(doc, x, tableTop, col.w, headerRowH, GOLD_LIGHT)
    doc.setTextColor(...INK)
    drawMultilineHeader(doc, col.label, x, tableTop, col.w)
    x += col.w
  }

  const monthRows = buildMonthRows(form, lines)
  doc.setFont(FONT_FAMILY, 'normal')
  doc.setFontSize(6.5)

  let y = tableTop + headerRowH
  for (const row of monthRows) {
    x = M.left
    const values = row.valid
      ? [row.dayName ?? '', row.dateStr ?? '', '', '', '', '', '', '', '', '']
      : ['', '', '', '', '', '', '', '', '', '']

    for (let i = 0; i < TABLE_COLUMNS.length; i++) {
      const col = TABLE_COLUMNS[i]!
      drawCell(doc, x, y, col.w, rowH)
      if (values[i]) {
        doc.setTextColor(...(row.valid ? INK : MUTED))
        doc.text(values[i], x + 1, y + rowH * 0.62)
      }
      x += col.w
    }
    y += rowH
  }

  const summaryY = PAGE_H - M.bottom - qrZoneH - 2
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.35)
  doc.line(M.left, summaryY - 14, PAGE_W - M.right - QR_SIZE - 6, summaryY - 14)

  doc.setFont(FONT_FAMILY, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...INK)
  doc.text('Celkem hodin: _______________', M.left, summaryY - 9)
  doc.text('Celkem ruční výkop (bm): __________', M.left + 48, summaryY - 9)
  doc.text('Celkem průrazů (ks): _____________', M.left + 96, summaryY - 9)
  doc.text('Celkem záloh (Kč): ________________', M.left, summaryY - 4)
  doc.text('Podpis zaměstnance: _____________________________', M.left, summaryY + 2)
  doc.text('Podpis vedoucího: ______________________________', M.left, summaryY + 7)

  const qrPayload = form.form_number
  const qr = await loadQrDataUrl(qrPayload)
  const qrX = PAGE_W - M.right - QR_SIZE
  const qrY = PAGE_H - M.bottom - QR_SIZE

  if (qr) {
    doc.addImage(qr, 'PNG', qrX, qrY, QR_SIZE, QR_SIZE)
  } else {
    drawCell(doc, qrX, qrY, QR_SIZE, QR_SIZE)
  }

  doc.setFont(FONT_FAMILY, 'bold')
  doc.setFontSize(6.5)
  doc.text('ID formuláře:', qrX - 32, qrY + 7)
  doc.setFont(FONT_FAMILY, 'normal')
  doc.setFontSize(7.5)
  doc.text(form.form_number, qrX - 32, qrY + 12)
}

export async function buildPaperMonthlyFormPdfBlob(
  form: PaperMonthlyForm,
  lines: PaperFormLine[],
  company: CompanySettings
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  await ensurePdfFonts(doc)
  await drawPaperMonthlyFormPage(doc, form, lines, company)
  const blob = doc.output('blob')
  assertValidPdfBlob(blob)
  return blob
}

export function getPaperFormPdfFilename(form: PaperMonthlyForm): string {
  const period = `${form.year}-${String(form.month).padStart(2, '0')}`
  return `mesicni_vykaz_${form.form_number}_${period}.pdf`
}

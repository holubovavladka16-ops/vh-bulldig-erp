/**
 * Náhled PDF Varianty 1 — jedna stránka A4, mock předvyplnění.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { jsPDF } from 'jspdf'

const pdfSrc = readFileSync(resolve(process.cwd(), 'src/lib/paperForms/pdf.ts'), 'utf8')
const colMatch = [...pdfSrc.matchAll(/\{\s*key:\s*'[^']+',\s*label:[^,]+,\s*w:\s*(\d+)/g)]
const cols = colMatch.map((m) => Number(m[1]))
if (cols.length !== 10) {
  console.error(`CHYBA: očekáváno 10 sloupců, nalezeno ${cols.length}`)
  process.exit(1)
}

const PAGE_W = 210
const PAGE_H = 297
const M = { top: 7, right: 7, bottom: 7, left: 7 }
const CONTENT_W = PAGE_W - M.left - M.right
const QR_SIZE = 20
const LOGO_BOX = 35
const LOGO_SUBTITLE = 'Zemní výkopové práce všech inženýrských sítí'
const footerH = 26
const qrZoneH = QR_SIZE + 4
const headerTop = M.top + 2
const tableTop = headerTop + 48
const tableBottom = PAGE_H - M.bottom - footerH - qrZoneH
const headerRowH = 6.2
const rowH = (tableBottom - tableTop - headerRowH) / 31

const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
doc.setFillColor(255, 255, 255)
doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

// Logo čtverec
doc.setDrawColor(180, 180, 180)
doc.setLineWidth(0.3)
doc.rect(M.left, headerTop, LOGO_BOX, LOGO_BOX)
doc.setFontSize(6)
doc.setTextColor(120, 120, 120)
doc.text('LOGO 1:1', M.left + LOGO_BOX / 2, headerTop + LOGO_BOX / 2, { align: 'center' })
doc.setFontSize(5.2)
doc.setTextColor(68, 68, 68)
const subLines = doc.splitTextToSize(LOGO_SUBTITLE, LOGO_BOX)
subLines.forEach((line, i) => {
  doc.text(line, M.left + LOGO_BOX / 2, headerTop + LOGO_BOX + 3 + i * 2.4, { align: 'center' })
})

const titleX = M.left + LOGO_BOX + 3
doc.setFont('helvetica', 'bold')
doc.setFontSize(13)
doc.setTextColor(184, 148, 58)
doc.text('MĚSÍČNÍ PRACOVNÍ VÝKAZ', titleX, headerTop + 12)

const info = [
  ['Jméno', 'Jan'],
  ['Příjmení', 'Novák'],
  ['Datum narození', '15. 3. 1985'],
  ['Adresa', 'Praha 5, Ulice 12'],
  ['Datum nástupu', '1. 1. 2020'],
  ['Pozice', 'Dělník'],
  ['Pracovní poměr', 'HPP'],
  ['Měsíc', 'Červenec'],
  ['Rok', '2026'],
]
doc.setFontSize(7)
doc.setFont('helvetica', 'normal')
const infoX = titleX
const infoY = headerTop + 18
const colSplit = infoX + 46
info.forEach(([label, value], i) => {
  const x = i < 5 ? infoX : colSplit
  const y = i < 5 ? infoY + i * 3.6 : infoY + (i - 5) * 3.6
  doc.setTextColor(90, 90, 90)
  doc.text(`${label}:`, x, y)
  doc.setTextColor(26, 26, 26)
  doc.text(value, x + 22, y)
})
doc.setFont('helvetica', 'bold')
doc.setFontSize(6.5)
doc.text('ID: PF-2026-00042', colSplit + 22, infoY + 14)

const headers = [
  'Den', 'Datum', 'Zakázka', 'Od', 'Do', 'Celkem hodin',
  'Ruční výkop', 'Průraz do objektu', 'Záloha (Kč)', 'Podpis',
]
let x = M.left
let y = tableTop
for (let i = 0; i < cols.length; i++) {
  doc.setFillColor(245, 236, 210)
  doc.rect(x, y, cols[i], headerRowH, 'FD')
  doc.setFontSize(5)
  doc.setTextColor(26, 26, 26)
  doc.text(headers[i], x + cols[i] / 2, y + 3.8, { align: 'center' })
  x += cols[i]
}
y += headerRowH

for (let row = 0; row < 31; row++) {
  x = M.left
  for (const w of cols) {
    doc.setDrawColor(40)
    doc.rect(x, y, w, rowH)
    x += w
  }
  y += rowH
}

const summaryY = PAGE_H - M.bottom - qrZoneH - 2
doc.setDrawColor(184, 148, 58)
doc.line(M.left, summaryY - 14, PAGE_W - M.right - QR_SIZE - 6, summaryY - 14)
doc.setFontSize(7)
doc.setTextColor(26, 26, 26)
doc.text('Celkem hodin: _______________', M.left, summaryY - 9)
doc.text('Celkem ruční výkop (bm): __________', M.left + 48, summaryY - 9)
doc.text('Celkem průrazů (ks): _____________', M.left + 96, summaryY - 9)
doc.text('Celkem záloh (Kč): ________________', M.left, summaryY - 4)
doc.text('Podpis zaměstnance: _____________________________', M.left, summaryY + 2)
doc.text('Podpis vedoucího: ______________________________', M.left, summaryY + 7)

const qrX = PAGE_W - M.right - QR_SIZE
const qrY = PAGE_H - M.bottom - QR_SIZE
doc.setDrawColor(0)
doc.rect(qrX, qrY, QR_SIZE, QR_SIZE)
doc.setFontSize(5)
doc.text('QR', qrX + QR_SIZE / 2, qrY + QR_SIZE / 2, { align: 'center' })
doc.setFont('helvetica', 'bold')
doc.setFontSize(6.5)
doc.text('ID formuláře:', qrX - 34, qrY + 7)
doc.setFont('helvetica', 'normal')
doc.setFontSize(7.5)
doc.text('PF-2026-00042', qrX - 34, qrY + 12)

const outDir = resolve(process.cwd(), 'tmp')
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, 'paper-form-v1-preview.pdf')
writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')))

const sum = cols.reduce((a, b) => a + b, 0)
console.log(`Sloupce: ${cols.join(', ')} mm (součet ${sum}, očekáváno ${CONTENT_W})`)
console.log(`Výška řádku: ${rowH.toFixed(2)} mm`)
console.log(`Stránek: ${doc.getNumberOfPages()}`)
console.log(`Náhled: ${outPath}`)

if (sum !== CONTENT_W || doc.getNumberOfPages() !== 1) process.exit(1)
console.log('OK: Variant 1 náhled na jedné stránce A4')

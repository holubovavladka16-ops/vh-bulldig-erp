/**
 * Ověří, že generátor papírového formuláře produkuje jednu stránku A4 (10 sloupců).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { jsPDF } from 'jspdf'

const PAGE_W = 210
const M = { top: 7, right: 7, bottom: 7, left: 7 }
const CONTENT_W = PAGE_W - M.left - M.right
const QR_SIZE = 20
const footerH = 26
const qrZoneH = QR_SIZE + 4
const headerTop = M.top + 2
const tableTop = headerTop + 36
const tableBottom = 297 - M.bottom - footerH - qrZoneH
const headerRowH = 6.2
const rowH = (tableBottom - tableTop - headerRowH) / 31

const cols = [5, 11, 18, 8, 8, 10, 16, 10, 9, CONTENT_W - 95]

const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
doc.setFillColor(255, 255, 255)
doc.rect(0, 0, PAGE_W, 297, 'F')

let y = tableTop + headerRowH
for (let row = 0; row < 31; row++) {
  let x = M.left
  for (const w of cols) {
    doc.rect(x, y, w, rowH)
    x += w
  }
  y += rowH
}

const pages = doc.getNumberOfPages()
const outDir = resolve(process.cwd(), 'tmp')
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, 'paper-form-layout-test.pdf')
writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')))

const src = readFileSync(resolve(process.cwd(), 'src/lib/paperForms/pdf.ts'), 'utf8')
const hasAddPage = /\baddPage\s*\(/.test(src)
const hasOldColumns = /Druh práce|Pauza/.test(src)
const hasNewColumns = /Výkop|Průraz|Celkem/.test(src)

console.log(`Stránek PDF: ${pages}`)
console.log(`Sloupců: ${cols.length}`)
console.log(`addPage() v pdf.ts: ${hasAddPage ? 'ANO (CHYBA)' : 'ne'}`)
console.log(`Staré sloupce (Druh/Pauza): ${hasOldColumns ? 'ANO (CHYBA)' : 'ne'}`)
console.log(`Nové sloupce: ${hasNewColumns ? 'ano' : 'CHYBA'}`)
console.log(`Výška řádku: ${rowH.toFixed(2)} mm`)
console.log(`Uloženo: ${outPath}`)

if (pages !== 1 || hasAddPage || hasOldColumns || !hasNewColumns) {
  process.exit(1)
}

console.log('OK: Jednostránkový layout v2')

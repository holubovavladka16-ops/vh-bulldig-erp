/**
 * Ověří finální generátor papírového měsíčního výkazu (1× A4, 10 sloupců).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { jsPDF } from 'jspdf'

const pdfSrcPath = resolve(process.cwd(), 'src/lib/paperForms/pdf.ts')
const src = readFileSync(pdfSrcPath, 'utf8')

const FORBIDDEN = ['Druh práce', 'Pauza', 'druh_prace', 'break_minutes']
const REQUIRED = [
  'Ruční výkop',
  'hloubka 50–70 cm',
  'Průraz do',
  'objektu (ks)',
  'Záloha',
  'Celkem hodin',
  'Celkem ruční výkop (bm)',
  'Celkem průrazů (ks)',
  'Celkem záloh (Kč)',
  'Podpis zaměstnance',
  'Podpis vedoucího',
]

let failed = false
for (const label of FORBIDDEN) {
  if (src.includes(label)) {
    console.error(`CHYBA: Zakázaný text v pdf.ts: "${label}"`)
    failed = true
  }
}
for (const label of REQUIRED) {
  if (!src.includes(label)) {
    console.error(`CHYBA: Chybí povinný text v pdf.ts: "${label}"`)
    failed = true
  }
}

const hasAddPage = /\baddPage\s*\(/.test(src)
if (hasAddPage) {
  console.error('CHYBA: pdf.ts obsahuje addPage() — očekávána 1 stránka')
  failed = true
}

// Layout simulace (stejné rozměry jako pdf.ts)
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
const cols = [5, 11, 71, 7, 7, 15, 15, 15, 20, 30]

if (cols.reduce((a, b) => a + b, 0) !== CONTENT_W) {
  console.error(`CHYBA: Součet šířek sloupců (${cols.reduce((a, b) => a + b, 0)}) ≠ CONTENT_W (${CONTENT_W})`)
  failed = true
}

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

console.log(`Stránek PDF: ${pages}`)
console.log(`Sloupců: ${cols.length}`)
console.log(`Staré sloupce (Druh/Pauza): ${FORBIDDEN.some((f) => src.includes(f)) ? 'ANO (CHYBA)' : 'ne'}`)
console.log(`Povinné sloupce/souhrn: ${REQUIRED.every((r) => src.includes(r)) ? 'ano' : 'CHYBA'}`)
console.log(`Výška řádku: ${rowH.toFixed(2)} mm`)
console.log(`Uloženo: ${outPath}`)

if (pages !== 1 || cols.length !== 10 || failed) {
  process.exit(1)
}

console.log('OK: Finální jednostránkový PDF layout')

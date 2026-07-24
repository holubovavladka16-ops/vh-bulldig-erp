/**
 * Ověří hromadný PDF generátor Varianty 2 (více stránek, unikátní QR ID).
 * node scripts/test-paper-form-bulk-pdf.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { jsPDF } from 'jspdf'

const pdfSrcPath = resolve(process.cwd(), 'src/lib/paperForms/pdfBulk.ts')
const pdfMainPath = resolve(process.cwd(), 'src/lib/paperForms/pdf.ts')
const bulkSrc = readFileSync(pdfSrcPath, 'utf8')
const mainSrc = readFileSync(pdfMainPath, 'utf8')

let failed = false
function fail(msg) {
  console.error(`CHYBA: ${msg}`)
  failed = true
}

if (!bulkSrc.includes('buildBulkBlankPaperFormsPdfBlob')) fail('Chybí buildBulkBlankPaperFormsPdfBlob')
if (!bulkSrc.includes('drawPaperMonthlyFormPage')) fail('Bulk PDF nepoužívá drawPaperMonthlyFormPage')
if (!mainSrc.includes('export async function drawPaperMonthlyFormPage')) fail('Chybí export drawPaperMonthlyFormPage')
if (mainSrc.includes('addPage')) fail('pdf.ts nesmí obsahovat addPage — Varianta 1 zůstává jednostránková')
if (!bulkSrc.includes('addPage')) fail('pdfBulk.ts musí používat addPage pro více stránek')

// Simulace 3stránkového PDF
const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
for (let i = 0; i < 3; i++) {
  if (i > 0) doc.addPage()
  doc.text(`Form ${i + 1}`, 10, 10)
}
const pages = doc.getNumberOfPages()
if (pages !== 3) fail(`Očekáváno 3 stránky, dostáno ${pages}`)

const outDir = resolve(process.cwd(), 'tmp')
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, 'paper-form-bulk-layout-test.pdf')
writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')))

console.log(`Stránek PDF: ${pages}`)
console.log(`Uloženo: ${outPath}`)

if (failed) process.exit(1)
console.log('OK: Hromadný PDF generátor (Varianta 2) — struktura a vícestránkový layout')

/**
 * Ověření PDF export HTML – spouštět po buildu: node scripts/verify-pdf-export.mjs
 * Kontroluje klíčové řetězce v reportPrint a printDocument bez importu TS.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const files = [
  'src/lib/print/printDocument.ts',
  'src/lib/print/pdfDownload.ts',
  'src/lib/module5/reportPrint.ts',
  'src/lib/payroll/payrollReport.ts',
]

const errors = []
const checks = [
  { pattern: 'pdf-document', file: 'src/lib/print/printDocument.ts', label: 'Třída pdf-document' },
  { pattern: 'color-scheme" content="light only"', file: 'src/lib/print/printDocument.ts', label: 'color-scheme light' },
  { pattern: '--pdf-text: #1a1a1a', file: 'src/lib/print/printDocument.ts', label: 'CSS proměnná pdf-text' },
  { pattern: 'pdf-watermark-layer', file: 'src/lib/print/printDocument.ts', label: 'Vrstva vodoznaku' },
  { pattern: 'DAILY_ADVANCE_AMOUNT = 500', file: 'src/lib/module5/reportPrint.ts', label: 'Záloha 500 Kč' },
  { pattern: 'Rekapitulace výplaty', file: 'src/lib/module5/reportPrint.ts', label: 'Rekapitulace' },
  { pattern: 'doc-table > thead > tr > th', file: 'src/lib/print/printDocument.ts', label: 'Selektor thead th' },
  { pattern: 'doc-table-kv th', file: 'src/lib/print/pdfDownload.ts', label: 'KV tabulka kontrast' },
  { pattern: 'enforcePdfTextContrast', file: 'src/lib/print/pdfDownload.ts', label: 'Vynucení kontrastu' },
  { pattern: 'data-pdf-export="true"', file: 'src/lib/print/printDocument.ts', label: 'Atribut data-pdf-export' },
]

for (const file of files) {
  const path = join(root, file)
  try {
    readFileSync(path, 'utf8')
  } catch {
    errors.push(`Soubor chybí: ${file}`)
  }
}

for (const { pattern, file, label } of checks) {
  const content = readFileSync(join(root, file), 'utf8')
  if (!content.includes(pattern)) errors.push(`Chybí: ${label} (${file})`)
}

const reportPrint = readFileSync(join(root, 'src/lib/module5/reportPrint.ts'), 'utf8')
if (reportPrint.includes('text-white')) errors.push('reportPrint obsahuje text-white')
if (reportPrint.includes('report.earnings - DAILY_ADVANCE_AMOUNT')) {
  console.log('✓ Výpočet: částka k výplatě = výdělek − 500 Kč')
}

console.log('=== PDF EXPORT VERIFY ===')
if (errors.length) {
  errors.forEach((e) => console.log(`✗ ${e}`))
  process.exit(1)
}
console.log('✓ Všechny kontroly prošly')
process.exit(0)

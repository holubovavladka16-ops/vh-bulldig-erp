/**
 * Ověří GPS fotodoklad PDF pipeline:
 * - generátor volá assertGpsPhotoPdfBlob (1× A4)
 * - sdílení posílá binární PDF bez URL/wa.me
 * - unit testy photoReportPdfSpec
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const photoReportPdfPath = resolve(root, 'src/lib/photos/photoReportPdf.ts')
const sharePayloadPath = resolve(root, 'src/lib/photos/sharePayload.ts')
const pdfDownloadPath = resolve(root, 'src/lib/print/pdfDownload.ts')

const photoReportPdfSrc = readFileSync(photoReportPdfPath, 'utf8')
const sharePayloadSrc = readFileSync(sharePayloadPath, 'utf8')
const pdfDownloadSrc = readFileSync(pdfDownloadPath, 'utf8')

let failed = false

function fail(message) {
  console.error(`CHYBA: ${message}`)
  failed = true
}

if (!photoReportPdfSrc.includes('assertGpsPhotoPdfBlob')) {
  fail('photoReportPdf.ts nevolá assertGpsPhotoPdfBlob po generování PDF.')
}

if (!photoReportPdfSrc.includes("format: 'a4'")) {
  fail('photoReportPdf.ts negeneruje PDF ve formátu A4.')
}

for (const forbidden of ['wa.me', 'getWhatsAppShareUrl', 'getEmailShareUrl', 'buildPhotoShareText', 'buildPhotoPdfShareText']) {
  const codeOnly = sharePayloadSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  if (codeOnly.includes(forbidden)) {
    fail(`sharePayload.ts stále obsahuje zakázanou textovou větev: ${forbidden}`)
  }
}

if (!sharePayloadSrc.includes('createPhotoReportPdfFile')) {
  fail('sharePayload.ts nepoužívá createPhotoReportPdfFile pro binární PDF.')
}

if (!sharePayloadSrc.includes('sharePdfFile')) {
  fail('sharePayload.ts nesdílí PDF přes sharePdfFile.')
}

if (!pdfDownloadSrc.includes("await navigator.share({ files: [pdfFile] })")) {
  fail('pdfDownload.ts nesdílí pouze PDF soubor bez textu/URL.')
}

const vitest = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'src/lib/photos/photoReportPdfSpec.test.ts'], {
  cwd: root,
  stdio: 'inherit',
})

if (vitest.status !== 0) {
  fail('Unit testy photoReportPdfSpec selhaly.')
}

if (failed) {
  process.exit(1)
}

console.log('OK: GPS fotodoklad PDF – 1× A4 validace, binární sdílení, unit testy')

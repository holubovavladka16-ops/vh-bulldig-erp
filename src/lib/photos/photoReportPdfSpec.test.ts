import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import {
  assertGpsPhotoPdfBytes,
  GPS_PHOTO_PDF_HEIGHT_MM,
  GPS_PHOTO_PDF_PAGE_COUNT,
  GPS_PHOTO_PDF_WIDTH_MM,
  inspectGpsPhotoPdfBytes,
} from '@/lib/photos/photoReportPdfSpec'

function buildSamplePdf(pageCount: number): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  doc.text('GPS fotodoklad test', 10, 20)
  for (let i = 1; i < pageCount; i++) {
    doc.addPage('a4', 'portrait')
  }
  return new Uint8Array(doc.output('arraybuffer'))
}

describe('photoReportPdfSpec', () => {
  it('rozpozná 1× A4 PDF (210×297 mm)', () => {
    const bytes = buildSamplePdf(1)
    const metrics = inspectGpsPhotoPdfBytes(bytes)

    expect(metrics.pageCount).toBe(GPS_PHOTO_PDF_PAGE_COUNT)
    expect(metrics.widthMm).toBeGreaterThan(GPS_PHOTO_PDF_WIDTH_MM - 1)
    expect(metrics.widthMm).toBeLessThan(GPS_PHOTO_PDF_WIDTH_MM + 1)
    expect(metrics.heightMm).toBeGreaterThan(GPS_PHOTO_PDF_HEIGHT_MM - 1)
    expect(metrics.heightMm).toBeLessThan(GPS_PHOTO_PDF_HEIGHT_MM + 1)
  })

  it('assertGpsPhotoPdfBytes projde u 1× A4', () => {
    const bytes = buildSamplePdf(1)
    const metrics = assertGpsPhotoPdfBytes(bytes)
    expect(metrics.pageCount).toBe(1)
  })

  it('assertGpsPhotoPdfBytes selže u více stránek', () => {
    const bytes = buildSamplePdf(2)
    expect(() => assertGpsPhotoPdfBytes(bytes)).toThrow(/1 stránku/)
  })

  it('assertGpsPhotoPdfBytes selže u neplatného souboru', () => {
    expect(() => assertGpsPhotoPdfBytes(new Uint8Array([1, 2, 3]))).toThrow(/platné PDF/)
  })
})

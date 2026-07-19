/** Požadavky na binární GPS fotodoklad – 1× A4 (210×297 mm). */
export const GPS_PHOTO_PDF_PAGE_COUNT = 1
export const GPS_PHOTO_PDF_WIDTH_MM = 210
export const GPS_PHOTO_PDF_HEIGHT_MM = 297
export const GPS_PHOTO_PDF_SIZE_TOLERANCE_MM = 1.5

const PT_TO_MM = 25.4 / 72

export interface GpsPhotoPdfMetrics {
  pageCount: number
  widthPt: number
  heightPt: number
  widthMm: number
  heightMm: number
}

function bytesToLatin1(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]!)
  }
  return out
}

function countPdfPages(source: string): number {
  const pageObjects = source.match(/\/Type\s*\/Page(?![a-zA-Z])/g)
  if (pageObjects?.length) return pageObjects.length

  const countMatches = [...source.matchAll(/\/Count\s+(\d+)/g)]
  if (countMatches.length > 0) {
    return Math.max(...countMatches.map((match) => Number(match[1])))
  }

  return 0
}

function readFirstPageBox(source: string): { width: number; height: number } {
  const media = source.match(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/)
  if (media) {
    return {
      width: Number(media[3]) - Number(media[1]),
      height: Number(media[4]) - Number(media[2]),
    }
  }

  const crop = source.match(/\/CropBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/)
  if (crop) {
    return {
      width: Number(crop[3]) - Number(crop[1]),
      height: Number(crop[4]) - Number(crop[2]),
    }
  }

  return { width: 595.28, height: 841.89 }
}

export function inspectGpsPhotoPdfBytes(bytes: Uint8Array): GpsPhotoPdfMetrics {
  if (bytes.length < 512 || bytesToLatin1(bytes.slice(0, 5)) !== '%PDF-') {
    throw new Error('Soubor není platné PDF.')
  }

  const source = bytesToLatin1(bytes)
  const box = readFirstPageBox(source)
  const pageCount = countPdfPages(source)

  return {
    pageCount,
    widthPt: box.width,
    heightPt: box.height,
    widthMm: box.width * PT_TO_MM,
    heightMm: box.height * PT_TO_MM,
  }
}

export function assertGpsPhotoPdfBytes(bytes: Uint8Array): GpsPhotoPdfMetrics {
  const metrics = inspectGpsPhotoPdfBytes(bytes)

  if (metrics.pageCount !== GPS_PHOTO_PDF_PAGE_COUNT) {
    throw new Error(
      `GPS fotodoklad musí mít přesně ${GPS_PHOTO_PDF_PAGE_COUNT} stránku, PDF má ${metrics.pageCount}.`
    )
  }

  if (Math.abs(metrics.widthMm - GPS_PHOTO_PDF_WIDTH_MM) > GPS_PHOTO_PDF_SIZE_TOLERANCE_MM) {
    throw new Error(
      `GPS fotodoklad musí mít šířku ${GPS_PHOTO_PDF_WIDTH_MM} mm, PDF má ${metrics.widthMm.toFixed(1)} mm.`
    )
  }

  if (Math.abs(metrics.heightMm - GPS_PHOTO_PDF_HEIGHT_MM) > GPS_PHOTO_PDF_SIZE_TOLERANCE_MM) {
    throw new Error(
      `GPS fotodoklad musí mít výšku ${GPS_PHOTO_PDF_HEIGHT_MM} mm, PDF má ${metrics.heightMm.toFixed(1)} mm.`
    )
  }

  return metrics
}

export async function assertGpsPhotoPdfBlob(blob: Blob): Promise<GpsPhotoPdfMetrics> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return assertGpsPhotoPdfBytes(bytes)
}

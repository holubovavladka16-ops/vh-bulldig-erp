import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export function isMobilePrintDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const narrow = window.matchMedia('(max-width: 768px)').matches
  return mobileUa || narrow
}

export function sanitizePdfFileName(name: string): string {
  const base = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const withExt = base.toLowerCase().endsWith('.pdf') ? base : `${base || 'dokument'}.pdf`
  return withExt
}

export function extractDocumentTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match?.[1]?.trim() || 'Dokument VH Bulldig'
}

export function buildDefaultPdfFileName(html: string): string {
  return sanitizePdfFileName(extractDocumentTitle(html).replace(/\s+/g, '-'))
}

export function pdfBlobToFile(pdfBlob: Blob, fileName: string): File {
  const safeName = sanitizePdfFileName(fileName)
  return new File([ensurePdfBlob(pdfBlob)], safeName, { type: 'application/pdf' })
}

export function ensurePdfBlob(blob: Blob): Blob {
  if (blob.type === 'application/pdf') return blob
  return new Blob([blob], { type: 'application/pdf' })
}

export async function assertValidPdfBlob(blob: Blob): Promise<void> {
  const pdf = ensurePdfBlob(blob)
  if (!pdf || pdf.size < 512) {
    throw new Error('PDF soubor je prázdný nebo poškozený.')
  }

  const header = await pdf.slice(0, 5).text()
  if (!header.startsWith('%PDF')) {
    throw new Error('Vygenerované PDF je neplatné.')
  }
}

export function downloadPdfBlob(pdfBlob: Blob, fileName: string): void {
  const file = pdfBlobToFile(pdfBlob, fileName)
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  window.setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link)
    URL.revokeObjectURL(url)
  }, 5000)
}

export type SharePdfResult = 'shared' | 'cancelled' | 'unsupported'

export async function sharePdfFile(
  pdfBlob: Blob,
  fileName: string
): Promise<SharePdfResult> {
  const pdfFile = pdfBlobToFile(pdfBlob, fileName)

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [pdfFile] })) {
    try {
      await navigator.share({ files: [pdfFile] })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  return 'unsupported'
}

async function waitForDocumentImages(doc: Document): Promise<void> {
  const images = Array.from(doc.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          window.setTimeout(done, 10_000)
        })
    )
  )
}

/** Převede HTML dokument na skutečný PDF blob (jsPDF + html2canvas, bez CDN). */
export async function htmlToPdfBlob(html: string): Promise<Blob> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'Generování PDF')
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;min-height:1123px;border:0;visibility:hidden;background:#ffffff;'
  document.body.appendChild(iframe)

  try {
    const frameWindow = iframe.contentWindow
    const frameDoc = frameWindow?.document
    if (!frameWindow || !frameDoc) {
      throw new Error('Nelze připravit dokument pro PDF.')
    }

    frameDoc.open()
    frameDoc.write(html)
    frameDoc.close()

    await new Promise<void>((resolve) => {
      if (frameDoc.readyState === 'complete') resolve()
      else iframe.onload = () => resolve()
    })

    if (frameDoc.fonts?.ready) {
      await frameDoc.fonts.ready.catch(() => undefined)
    }

    await waitForDocumentImages(frameDoc)
    await new Promise((resolve) => window.setTimeout(resolve, 250))

    const pageEl = frameDoc.querySelector<HTMLElement>('.doc-shell') ?? frameDoc.body
    const captureWidth = Math.max(pageEl.scrollWidth, pageEl.offsetWidth, 794)
    const captureHeight = Math.max(pageEl.scrollHeight, pageEl.offsetHeight, 1)

    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      scrollX: 0,
      scrollY: 0,
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      pdf.addPage()
      position = heightLeft - imgHeight
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
      heightLeft -= pageHeight
    }

    const blob = pdf.output('blob') as Blob
    const pdfBlob = ensurePdfBlob(blob)
    await assertValidPdfBlob(pdfBlob)
    return pdfBlob
  } finally {
    iframe.remove()
  }
}

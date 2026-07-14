const HTML2PDF_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js'

type Html2PdfWorker = {
  set: (options: Record<string, unknown>) => Html2PdfWorker
  from: (element: HTMLElement) => Html2PdfWorker
  outputPdf: (type: 'blob') => Promise<Blob>
}

type Html2PdfFactory = () => Html2PdfWorker

let html2pdfLoadPromise: Promise<void> | null = null

function loadHtml2PdfBundle(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PDF generování není dostupné mimo prohlížeč.'))
  }

  const win = window as Window & { html2pdf?: Html2PdfFactory }
  if (win.html2pdf) return Promise.resolve()

  if (!html2pdfLoadPromise) {
    html2pdfLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-vh-html2pdf]')
      if (existing) {
        if (win.html2pdf) {
          resolve()
          return
        }
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('Načtení PDF knihovny se nezdařilo.')), {
          once: true,
        })
        return
      }

      const script = document.createElement('script')
      script.src = HTML2PDF_CDN
      script.async = true
      script.dataset.vhHtml2pdf = 'true'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Načtení PDF knihovny se nezdařilo.'))
      document.head.appendChild(script)
    })
  }

  return html2pdfLoadPromise
}

async function getHtml2PdfFactory(): Promise<Html2PdfFactory> {
  await loadHtml2PdfBundle()
  const factory = (window as Window & { html2pdf?: Html2PdfFactory }).html2pdf
  if (!factory) throw new Error('PDF knihovna není dostupná.')
  return factory
}

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
  return new File([pdfBlob], safeName, { type: 'application/pdf' })
}

export function downloadPdfBlob(pdfBlob: Blob, fileName: string): void {
  const safeName = sanitizePdfFileName(fileName)
  const url = URL.createObjectURL(pdfBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = safeName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  window.setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link)
    URL.revokeObjectURL(url)
  }, 1500)
}

export type SharePdfResult = 'shared' | 'cancelled' | 'unsupported'

export async function sharePdfFile(
  pdfBlob: Blob,
  fileName: string,
  title: string,
  text?: string
): Promise<SharePdfResult> {
  const pdfFile = pdfBlobToFile(pdfBlob, fileName)

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title,
        text: text ?? title,
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  return 'unsupported'
}

export async function htmlToPdfBlob(html: string): Promise<Blob> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'Generování PDF')
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;visibility:hidden;background:#ffffff;'
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

    await new Promise((resolve) => window.setTimeout(resolve, 350))

    const pageEl = frameDoc.querySelector<HTMLElement>('.doc-shell') ?? frameDoc.body
    const captureWidth = pageEl.offsetWidth || pageEl.scrollWidth
    const captureHeight = pageEl.offsetHeight || pageEl.scrollHeight

    const html2pdf = await getHtml2PdfFactory()
    const blob = await html2pdf()
      .set({
        margin: 0,
        filename: 'dokument.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          backgroundColor: '#ffffff',
          width: captureWidth,
          height: captureHeight,
          windowWidth: captureWidth,
          windowHeight: captureHeight,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(pageEl)
      .outputPdf('blob')

    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error('Vygenerovaný PDF soubor je prázdný.')
    }

    return blob
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }
}

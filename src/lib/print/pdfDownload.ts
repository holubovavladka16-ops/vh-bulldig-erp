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

export function printPdfBlob(pdfBlob: Blob): void {
  const url = URL.createObjectURL(pdfBlob)
  const frame = document.createElement('iframe')
  frame.setAttribute('title', 'Tisk PDF')
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;border:0;'
  frame.src = url
  document.body.appendChild(frame)

  const cleanup = () => {
    URL.revokeObjectURL(url)
    if (frame.parentNode) frame.parentNode.removeChild(frame)
  }

  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } finally {
      window.setTimeout(cleanup, 60_000)
    }
  }
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

function waitForDocumentImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images)
  if (images.length === 0) return Promise.resolve()

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
    )
  ).then(() => undefined)
}

/** Vynutí tmavý text a bílé pozadí – html2canvas jinak přebírá barvy z dark mode aplikace. */
function enforcePdfTextContrast(doc: Document): void {
  const style = doc.createElement('style')
  style.setAttribute('data-pdf-contrast', 'true')
  style.textContent = `
    html, body {
      background: #ffffff !important;
      color: #1a1a1a !important;
      color-scheme: light only !important;
    }
    .pdf-document,
    .pdf-document .pdf-page,
    .pdf-document .pdf-content,
    .pdf-document .doc-shell,
    .pdf-document .doc-section,
    .pdf-document p,
    .pdf-document span,
    .pdf-document td,
    .pdf-document li,
    .pdf-document label,
    .pdf-document .doc-kv,
    .pdf-document .doc-kv > div,
    .pdf-document .doc-meta-grid,
    .pdf-document .doc-meta-grid > div,
    .pdf-document .doc-text,
    .pdf-document .doc-note-box,
    .pdf-document .doc-company-meta,
    .pdf-document .doc-sign-line,
    .pdf-document .doc-sign-role,
    .pdf-document .doc-footer {
      color: #1a1a1a !important;
      text-shadow: none !important;
    }
    .pdf-document .doc-kv .k,
    .pdf-document .doc-meta-grid .label,
    .pdf-document .doc-sign-role,
    .pdf-document .doc-footer {
      color: #4a4a4a !important;
    }
    .pdf-document .doc-company-name,
    .pdf-document .doc-title,
    .pdf-document .net-row th,
    .pdf-document .net-row td {
      color: #000000 !important;
    }
    .pdf-page,
    .pdf-document .doc-section,
    .pdf-document .doc-party,
    .pdf-document .doc-kv,
    .pdf-document .doc-meta-grid,
    .pdf-document .doc-photo-block {
      background: #ffffff !important;
    }
    .pdf-document .doc-section h2 {
      background: #111111 !important;
      color: #d4af37 !important;
    }
    .pdf-document .doc-table > thead > tr > th {
      background: #111111 !important;
      color: #ffffff !important;
      border-bottom: 2px solid #d4af37 !important;
    }
    .pdf-document .doc-table-kv th,
    .pdf-document .doc-summary-table th {
      background: #f7f7f7 !important;
      color: #1a1a1a !important;
      border: 1px solid #d7d7d7 !important;
    }
    .pdf-document .doc-table td,
    .pdf-document .doc-table-kv td {
      background: #ffffff !important;
      color: #1a1a1a !important;
    }
    .pdf-document .doc-table tbody tr:nth-child(even) td {
      background: #f7f7f7 !important;
      color: #1a1a1a !important;
    }
    .pdf-document .net-row th,
    .pdf-document .net-row td {
      background: #ffffff !important;
      color: #000000 !important;
      border-top: 3px solid #d4af37 !important;
      font-weight: 700 !important;
    }
  `
  doc.head.appendChild(style)

  doc.documentElement.classList.add('pdf-document')
  doc.body?.classList.add('pdf-document')

  doc.querySelectorAll<HTMLElement>('.pdf-page, .pdf-content, .doc-shell').forEach((el) => {
    el.style.setProperty('background', '#ffffff', 'important')
    el.style.setProperty('color', '#1a1a1a', 'important')
  })

  const content = doc.querySelector<HTMLElement>('.pdf-content')
  if (content) {
    content.style.setProperty('position', 'relative', 'important')
    content.style.setProperty('z-index', '1', 'important')
  }
}

/** Vynutí pevné mm rozměry loga a vodoznaku – html2canvas jinak bere původní pixelové rozměry obrázku. */
function enforcePdfImageDimensions(doc: Document): void {
  enforcePdfTextContrast(doc)

  doc.querySelectorAll<HTMLImageElement>('.pdf-company-logo, .doc-logo').forEach((img) => {
    img.removeAttribute('width')
    img.removeAttribute('height')
    img.style.setProperty('width', '22mm', 'important')
    img.style.setProperty('height', '22mm', 'important')
    img.style.setProperty('max-width', '22mm', 'important')
    img.style.setProperty('max-height', '22mm', 'important')
    img.style.setProperty('object-fit', 'contain', 'important')
    img.style.setProperty('display', 'block', 'important')
  })

  doc.querySelectorAll<HTMLImageElement>('.pdf-watermark-company, .doc-watermark').forEach((img) => {
    img.removeAttribute('width')
    img.removeAttribute('height')
    img.style.setProperty('position', 'absolute', 'important')
    img.style.setProperty('inset', '0', 'important')
    img.style.setProperty('width', '100%', 'important')
    img.style.setProperty('height', '100%', 'important')
    img.style.setProperty('object-fit', 'contain', 'important')
    img.style.setProperty('opacity', '1', 'important')
    img.style.setProperty('pointer-events', 'none', 'important')
  })

  doc.querySelectorAll<HTMLElement>('.pdf-watermark-layer').forEach((layer) => {
    layer.style.setProperty('position', 'absolute', 'important')
    layer.style.setProperty('left', '50%', 'important')
    layer.style.setProperty('top', '50%', 'important')
    layer.style.setProperty('transform', 'translate(-50%, -50%)', 'important')
    layer.style.setProperty('width', '100mm', 'important')
    layer.style.setProperty('height', '100mm', 'important')
    layer.style.setProperty('max-width', '50%', 'important')
    layer.style.setProperty('max-height', '50%', 'important')
    layer.style.setProperty('z-index', '0', 'important')
    layer.style.setProperty('pointer-events', 'none', 'important')
    layer.style.setProperty('overflow', 'hidden', 'important')
    layer.style.setProperty('opacity', '0.04', 'important')
  })

  doc.querySelectorAll<HTMLElement>('.doc-footer').forEach((footer) => {
    footer.style.position = 'static'
    footer.style.marginTop = '14mm'
    footer.style.left = 'auto'
    footer.style.right = 'auto'
    footer.style.bottom = 'auto'
  })

  doc.querySelectorAll<HTMLElement>('.page-num').forEach((el) => {
    el.textContent = '1 / 1'
  })

  if (doc.querySelector('.doc-footer .page-num')) {
    const style = doc.createElement('style')
    style.textContent = '.doc-footer .page-num::after { content: none !important; }'
    doc.head.appendChild(style)
  }

  const page = doc.querySelector<HTMLElement>('.pdf-page')
  if (page) {
    page.style.setProperty('overflow', 'visible', 'important')
    page.style.setProperty('background', '#ffffff', 'important')
    page.style.setProperty('color', '#1a1a1a', 'important')
    page.style.setProperty('height', 'auto', 'important')
    page.style.setProperty('max-height', 'none', 'important')
  }
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

    await waitForDocumentImages(frameDoc)
    enforcePdfImageDimensions(frameDoc)
    await new Promise((resolve) => window.setTimeout(resolve, 400))

    const pageEl = frameDoc.querySelector<HTMLElement>('.pdf-page') ?? frameDoc.querySelector<HTMLElement>('.pdf-content') ?? frameDoc.body
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
          onclone: (clonedDoc: Document) => {
            enforcePdfImageDimensions(clonedDoc)
          },
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

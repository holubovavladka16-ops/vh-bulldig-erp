import { isMobilePdfDevice } from '@/lib/print/mobileDetect'

export function ensurePdfBlob(blob: Blob): Blob {
  if (blob.type === 'application/pdf') return blob
  return new Blob([blob], { type: 'application/pdf' })
}

export async function assertValidPdfBlob(blob: Blob): Promise<void> {
  const pdf = ensurePdfBlob(blob)
  if (!pdf || pdf.size < 1024) {
    throw new Error('PDF soubor je prázdný nebo poškozený.')
  }

  const header = await pdf.slice(0, 5).text()
  if (!header.startsWith('%PDF')) {
    throw new Error('Vygenerované PDF je neplatné.')
  }
}

export function blobToPdfFile(blob: Blob, fileName: string): File {
  const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
  return new File([ensurePdfBlob(blob)], safeName, { type: 'application/pdf' })
}

export function canSharePdfFile(file: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return false
  }
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export function openPdfBlobInNewTab(blob: Blob): boolean {
  const url = URL.createObjectURL(ensurePdfBlob(blob))
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    URL.revokeObjectURL(url)
    return false
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
  return true
}

export function downloadPdfBlob(blob: Blob, fileName: string): void {
  if (isMobilePdfDevice()) {
    void downloadPdfBlobMobile(blob, fileName)
    return
  }

  const file = blobToPdfFile(blob, fileName)
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function downloadPdfBlobMobile(
  blob: Blob,
  fileName: string
): Promise<'shared' | 'opened' | 'downloaded'> {
  const shareResult = await sharePdfBlob(blob, fileName, fileName, { skipDownloadFallback: true })
  if (shareResult === 'shared') return 'shared'
  if (openPdfBlobInNewTab(blob)) return 'opened'
  const file = blobToPdfFile(blob, fileName)
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}

export async function sharePdfBlob(
  blob: Blob,
  fileName: string,
  title: string,
  options?: { skipDownloadFallback?: boolean }
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = blobToPdfFile(blob, fileName)

  if (canSharePdfFile(file) && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, files: [file] })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  if (options?.skipDownloadFallback) {
    return 'cancelled'
  }

  if (isMobilePdfDevice()) {
    if (openPdfBlobInNewTab(blob)) return 'downloaded'
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}

export async function printPdfBlob(blob: Blob, fileName = 'dokument.pdf'): Promise<boolean> {
  if (isMobilePdfDevice()) {
    const result = await sharePdfBlob(blob, fileName, 'Tisk PDF')
    if (result === 'shared' || result === 'downloaded') return true
    return openPdfBlobInNewTab(blob)
  }

  const pdfBlob = ensurePdfBlob(blob)
  const url = URL.createObjectURL(pdfBlob)

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.title = 'Tisk PDF'
    iframe.style.position = 'fixed'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'

    iframe.src = url
    document.body.appendChild(iframe)

    let finished = false
    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove()
        URL.revokeObjectURL(url)
      }, 60_000)
    }

    const finish = (ok: boolean) => {
      if (finished) return
      finished = true
      cleanup()
      resolve(ok)
    }

    iframe.onload = () => {
      window.setTimeout(() => {
        try {
          const win = iframe.contentWindow
          if (!win) {
            finish(false)
            return
          }
          win.focus()
          win.print()
          finish(true)
        } catch {
          finish(false)
        }
      }, 150)
    }

    iframe.onerror = () => finish(false)
    window.setTimeout(() => finish(false), 15_000)
  })
}

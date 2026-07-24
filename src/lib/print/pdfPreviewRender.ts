import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

function waitForContainerWidth(container: HTMLElement): Promise<number> {
  return new Promise((resolve) => {
    const readWidth = (): number => {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0) return rect.width
      const parent = container.parentElement
      if (parent) {
        const parentRect = parent.getBoundingClientRect()
        if (parentRect.width > 0) return parentRect.width - 16
      }
      return Math.max(280, Math.min(window.innerWidth - 16, 820))
    }

    const tryResolve = (): boolean => {
      const width = readWidth()
      if (width > 0) {
        resolve(width)
        return true
      }
      return false
    }

    if (tryResolve()) return

    const observer = new ResizeObserver(() => {
      if (tryResolve()) observer.disconnect()
    })
    observer.observe(container)
    if (container.parentElement) observer.observe(container.parentElement)

    requestAnimationFrame(() => {
      if (tryResolve()) {
        observer.disconnect()
        return
      }
      window.setTimeout(() => {
        observer.disconnect()
        resolve(readWidth())
      }, 120)
    })
  })
}

export async function renderPdfBlobPreview(container: HTMLElement, pdfBlob: Blob): Promise<void> {
  container.replaceChildren()

  const loading = document.createElement('p')
  loading.className = 'py-8 text-center text-sm text-theme-muted'
  loading.textContent = 'Načítám náhled PDF…'
  container.appendChild(loading)

  try {
    const containerWidth = await waitForContainerWidth(container)
    const data = await pdfBlob.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data }).promise

    container.replaceChildren()

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = containerWidth / baseViewport.width
      const viewport = page.getViewport({ scale })

      const wrap = document.createElement('div')
      wrap.className = 'mx-auto overflow-hidden rounded-lg border border-[#c5d0de] bg-white shadow-sm'
      wrap.style.width = '100%'
      wrap.style.maxWidth = `${containerWidth}px`

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      canvas.style.display = 'block'

      wrap.appendChild(canvas)
      container.appendChild(wrap)

      const ctx = canvas.getContext('2d')
      if (!ctx) continue

      await page.render({ canvasContext: ctx, viewport }).promise
    }
  } catch {
    container.replaceChildren()
    const error = document.createElement('p')
    error.className = 'py-8 text-center text-sm text-red-400'
    error.textContent = 'Náhled PDF se nepodařilo zobrazit. Dokument můžete stáhnout tlačítkem níže.'
    container.appendChild(error)
  }
}

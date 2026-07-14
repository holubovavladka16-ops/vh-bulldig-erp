import { downloadPdfBlob } from './pdfDownload'

export interface PdfPreviewOptions {
  title?: string
  shareText?: string
}

export function openPdfPreview(pdfBlob: Blob, fileName: string, options?: PdfPreviewOptions): void {
  const url = URL.createObjectURL(pdfBlob)
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    downloadPdfBlob(pdfBlob, fileName)
    return
  }
  
  win.document.title = options?.title || 'PDF náhled'
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${options?.title || 'PDF náhled'}</title>
      <style>
        body { margin: 0; padding: 0; display: flex; flex-direction: column; height: 100vh; background: #f5f5f5; font-family: system-ui, sans-serif; }
        .toolbar { background: #1e3a5f; color: white; padding: 12px 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .toolbar h1 { margin: 0; font-size: 16px; flex: 1; }
        .btn { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; }
        .btn:hover { background: #2563eb; }
        .btn-secondary { background: #6b7280; }
        .btn-secondary:hover { background: #4b5563; }
        .viewer { flex: 1; display: flex; justify-content: center; align-items: center; overflow: auto; }
        iframe { width: 100%; height: 100%; border: none; }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <h1>${options?.title || 'PDF náhled'}</h1>
        <button class="btn" onclick="downloadPdf()">Stáhnout PDF</button>
        <button class="btn btn-secondary" onclick="sharePdf()">Sdílet PDF</button>
      </div>
      <div class="viewer">
        <iframe src="${url}" type="application/pdf"></iframe>
      </div>
      <script>
        const pdfUrl = '${url}';
        const pdfFileName = '${fileName}';
        const shareTitle = '${options?.title || 'Dokument VH Bulldig'}';
        const shareText = '${options?.shareText || options?.title || 'Dokument VH Bulldig'}';
        
        function downloadPdf() {
          const link = document.createElement('a');
          link.href = pdfUrl;
          link.download = pdfFileName;
          link.click();
        }
        
        async function sharePdf() {
          try {
            const response = await fetch(pdfUrl);
            const blob = await response.blob();
            const file = new File([blob], pdfFileName, { type: 'application/pdf' });
            
            if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: shareTitle,
                text: shareText
              });
            } else {
              downloadPdf();
            }
          } catch (err) {
            if (err.name !== 'AbortError') {
              downloadPdf();
            }
          }
        }
      </script>
    </body>
    </html>
  `)
  win.document.close()
}

export async function withPdfGeneratingOverlay<T>(fn: () => Promise<T>): Promise<T> {
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); z-index: 99999;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; color: white; font-family: system-ui, sans-serif;
  `
  overlay.innerHTML = `
    <div style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    <p style="margin-top: 16px; font-size: 16px;">Generování PDF...</p>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  `
  document.body.appendChild(overlay)
  
  try {
    return await fn()
  } finally {
    document.body.removeChild(overlay)
  }
}

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileDown } from 'lucide-react'
import {
  buildPhotoReportPdfBlob,
  downloadPhotoReportPdf,
  getPhotoReportPdfFileName,
} from '@/lib/photos/photoReportPdf'
import { fetchPublicGpsPhoto, publicGpsPhotoToGpsPhoto } from '@/lib/photos/publicShare'

export function PublicPhotoSharePage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfFileName, setPdfFileName] = useState('gps-fotodoklad.pdf')

  useEffect(() => {
    if (!id?.trim()) {
      setError('Neplatný odkaz na fotodoklad.')
      setLoading(false)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null
    setLoading(true)
    setError('')
    setPdfUrl(null)

    fetchPublicGpsPhoto(id.trim())
      .then(async (result) => {
        if (cancelled) return
        if (!result) {
          setError('Fotodoklad nebyl nalezen nebo odkaz již není platný.')
          return
        }

        const photo = publicGpsPhotoToGpsPhoto(result)
        const pdfBlob = await buildPhotoReportPdfBlob(photo, null)
        objectUrl = URL.createObjectURL(pdfBlob)
        setPdfFileName(getPhotoReportPdfFileName(photo))
        setPdfUrl(objectUrl)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Načtení fotodokladu se nezdařilo.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  async function handleDownload() {
    if (!id?.trim()) return
    try {
      const result = await fetchPublicGpsPhoto(id.trim())
      if (!result) return
      await downloadPhotoReportPdf(publicGpsPhotoToGpsPhoto(result), null)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Stažení PDF se nezdařilo.')
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-300">
      {loading && (
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-400 border-t-neutral-700" />
        </div>
      )}

      {!loading && error && (
        <div className="mx-auto flex min-h-dvh max-w-lg items-center p-4">
          <div className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-6 text-center text-sm text-red-800">
            {error}
          </div>
        </div>
      )}

      {!loading && pdfUrl && (
        <div className="mx-auto flex min-h-dvh w-full max-w-[210mm] flex-col bg-neutral-200 py-3">
          <div className="mb-3 flex justify-center px-3">
            <button
              type="button"
              onClick={() => void handleDownload()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white"
            >
              <FileDown className="h-4 w-4" />
              Stáhnout PDF
            </button>
          </div>
          <iframe
            src={pdfUrl}
            title="GPS fotodoklad"
            className="mx-auto w-full border-0 bg-white shadow-lg"
            style={{ height: 'calc(100dvh - 72px)', maxWidth: '210mm' }}
          />
          <p className="mt-2 px-3 text-center text-xs text-neutral-600">{pdfFileName}</p>
        </div>
      )}
    </div>
  )
}

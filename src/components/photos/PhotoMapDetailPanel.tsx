import { useEffect, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { PhotoDocumentView } from '@/components/photos/PhotoDocumentView'
import { fetchGpsPhotoDetail, updateGpsPhotoNote } from '@/lib/photos/api'
import type { GpsPhotoDetail } from '@/types/photos'

interface PhotoMapDetailPanelProps {
  photoId: string
  onClose: () => void
  onUpdated?: () => void
  variant: 'sheet' | 'sidebar'
}

export function PhotoMapDetailPanel({ photoId, onClose, onUpdated, variant }: PhotoMapDetailPanelProps) {
  const { user } = useAuth()
  const [detail, setDetail] = useState<GpsPhotoDetail | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchGpsPhotoDetail(photoId)
      .then((data) => {
        setDetail(data)
        setNote(data?.note ?? '')
      })
      .finally(() => setLoading(false))
  }, [photoId])

  async function reload() {
    const data = await fetchGpsPhotoDetail(photoId)
    setDetail(data)
    setNote(data?.note ?? '')
    onUpdated?.()
  }

  async function handleSaveNote() {
    if (!user) return
    setSavingNote(true)
    try {
      await updateGpsPhotoNote(photoId, note, user.id)
      await reload()
    } finally {
      setSavingNote(false)
    }
  }

  const isSheet = variant === 'sheet'

  return (
    <>
      {isSheet && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-label="Zavřít detail"
        />
      )}

      <aside
        className={
          isSheet
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-hidden rounded-t-2xl border border-[var(--accent-primary)]/40 bg-[var(--bg-glass)] shadow-[0_-8px_40px_rgba(0,0,0,0.45)] lg:hidden'
            : 'hidden h-full w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--accent-primary)]/40 bg-[var(--bg-glass)] shadow-[0_0_24px_var(--accent-glow)] lg:flex lg:w-[min(420px,38vw)]'
        }
      >
        <div className="flex items-center justify-between border-b border-[var(--border-glass)] px-4 py-3">
          {isSheet && (
            <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20" aria-hidden />
          )}
          <h3 className="text-sm font-bold text-theme-primary">GPS fotodoklad</h3>
          <button
            type="button"
            onClick={onClose}
            className="touch-target rounded-lg p-1.5 hover:bg-white/5"
            aria-label="Zavřít"
          >
            {isSheet ? <ChevronDown className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </button>
        </div>

        <div className="scrollbar-premium flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
            </div>
          ) : !detail ? (
            <p className="py-12 text-center text-sm text-theme-secondary">Fotodoklad nenalezen.</p>
          ) : (
            <PhotoDocumentView
              photo={detail}
              note={note}
              onNoteChange={setNote}
              onSaveNote={handleSaveNote}
              savingNote={savingNote}
              userId={user?.id}
              onShared={reload}
            />
          )}
        </div>
      </aside>
    </>
  )
}

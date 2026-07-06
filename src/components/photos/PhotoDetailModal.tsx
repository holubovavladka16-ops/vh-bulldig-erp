import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isAdministrator } from '@/constants/permissions'
import { deleteGpsPhoto, fetchGpsPhotoDetail, updateGpsPhotoNote } from '@/lib/photos/api'
import { PhotoDocumentView } from '@/components/photos/PhotoDocumentView'
import type { GpsPhotoDetail } from '@/types/photos'

interface PhotoDetailModalProps {
  photoId: string | null
  onClose: () => void
  onUpdated: () => void
}

export function PhotoDetailModal({ photoId, onClose, onUpdated }: PhotoDetailModalProps) {
  const { user, profile } = useAuth()
  const isAdmin = profile ? isAdministrator(profile.role) : false
  const [detail, setDetail] = useState<GpsPhotoDetail | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!photoId) return
    setLoading(true)
    fetchGpsPhotoDetail(photoId)
      .then((data) => {
        setDetail(data)
        setNote(data?.note ?? '')
      })
      .finally(() => setLoading(false))
  }, [photoId])

  if (!photoId) return null

  async function reload() {
    if (!photoId) return
    const data = await fetchGpsPhotoDetail(photoId)
    setDetail(data)
    setNote(data?.note ?? '')
    onUpdated()
  }

  async function handleSaveNote() {
    if (!photoId || !user) return
    setSavingNote(true)
    try {
      await updateGpsPhotoNote(photoId, note, user.id)
      await reload()
    } finally {
      setSavingNote(false)
    }
  }

  async function handleDelete() {
    if (!detail || !user || !confirm('Smazat tuto fotografii a GPS doklad?')) return
    setDeleting(true)
    try {
      await deleteGpsPhoto(detail.id, detail.file_path, user.id)
      onUpdated()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-lg glass-panel scrollbar-premium p-0 sm:max-w-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-glass)] bg-[var(--bg-glass)]/95 px-4 py-3 backdrop-blur-md">
          <h2 className="text-lg font-bold text-theme-primary">GPS fotodoklad</h2>
          <button onClick={onClose} className="touch-target rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
            </div>
          ) : !detail ? (
            <p className="py-16 text-center text-theme-secondary">Fotodoklad nenalezen nebo byl smazán.</p>
          ) : (
            <PhotoDocumentView
              photo={detail}
              note={note}
              onNoteChange={setNote}
              onSaveNote={handleSaveNote}
              savingNote={savingNote}
              userId={user?.id}
              onDelete={isAdmin && user ? handleDelete : undefined}
              deleting={deleting}
              onShared={reload}
            />
          )}
        </div>
      </div>
    </div>
  )
}

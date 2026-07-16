import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckSquare, ImageIcon, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import { fetchDiaryPickerPhotos, type DiaryPhotoPickerMode } from '@/lib/diary/diaryPhotos'
import type { GpsPhoto } from '@/types/photos'
import { formatDate, formatTime } from '@/constants/workers'
import { formatPhotoAddress } from '@/lib/photos/photoDisplay'

interface DiaryPhotoPickerModalProps {
  open: boolean
  orderId: string
  entryDate: string
  selectedIds: string[]
  currentDiaryEntryId?: string | null
  onClose: () => void
  onConfirm: (ids: string[], photos: GpsPhoto[]) => void
}

export function DiaryPhotoPickerModal({
  open,
  orderId,
  entryDate,
  selectedIds,
  currentDiaryEntryId,
  onClose,
  onConfirm,
}: DiaryPhotoPickerModalProps) {
  const [mode, setMode] = useState<DiaryPhotoPickerMode>('day')
  const [photos, setPhotos] = useState<GpsPhoto[]>([])
  const [picked, setPicked] = useState<string[]>(selectedIds)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!open) return
    setPicked(selectedIds)
    setMode('day')
    setLoadError('')
  }, [open, selectedIds])

  useEffect(() => {
    if (!open || !entryDate) return

    setLoading(true)
    setLoadError('')

    fetchDiaryPickerPhotos(orderId, entryDate, mode, currentDiaryEntryId)
      .then(setPhotos)
      .catch((err) => {
        setPhotos([])
        setLoadError(err instanceof Error ? err.message : 'Načtení fotografií se nezdařilo')
      })
      .finally(() => setLoading(false))
  }, [open, orderId, entryDate, mode, currentDiaryEntryId])

  if (!open) return null

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function selectAll() {
    setPicked(photos.map((p) => p.id))
  }

  function clearAll() {
    setPicked([])
  }

  function confirm() {
    const selected = photos.filter((p) => picked.includes(p.id))
    onConfirm(picked, selected)
    onClose()
  }

  const content = (
    <div className="modal-overlay" style={{ zIndex: 300 }}>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-xl glass-panel neon-border scrollbar-premium">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-theme-primary">Fotodokumentace aplikace</h2>
            <p className="text-sm text-theme-muted">
              Vyberte fotografie z modulu Fotky s GPS. Galerie telefonu není povolena.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'day' ? 'primary' : 'secondary'}
            onClick={() => setMode('day')}
          >
            Zakázka + den
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'all_day' ? 'primary' : 'secondary'}
            onClick={() => setMode('all_day')}
          >
            Všechny fotky dne ({formatDate(entryDate)})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'order' ? 'primary' : 'secondary'}
            onClick={() => setMode('order')}
            disabled={!orderId}
          >
            Všechny fotky zakázky
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={selectAll} disabled={photos.length === 0}>
            <CheckSquare className="h-4 w-4" />
            Vybrat vše
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={clearAll} disabled={picked.length === 0}>
            <Square className="h-4 w-4" />
            Zrušit výběr
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          </div>
        ) : loadError ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-300">
            {loadError}
          </p>
        ) : photos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-glass)] px-4 py-10 text-center text-sm text-theme-muted">
            <p>Pro tento výběr nejsou žádné fotografie.</p>
            <p className="mt-2">Zkuste „Všechny fotky dne“ nebo ověřte, že fotky v modulu Fotodokumentace mají správné datum.</p>
          </div>
        ) : (
          <div className="grid max-h-[50vh] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 scrollbar-premium">
            {photos.map((photo) => {
              const selected = picked.includes(photo.id)
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => toggle(photo.id)}
                  className={`rounded-xl border p-2 text-left transition-colors ${
                    selected
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                      : 'border-[var(--border-glass)] hover:bg-white/5'
                  }`}
                >
                  <img src={getGpsPhotoUrl(photo.file_path)} alt="" className="h-28 w-full rounded-lg object-cover" />
                  <p className="mt-2 text-xs font-medium text-theme-primary">
                    {formatDate(photo.captured_date)} · {formatTime(photo.captured_time)}
                  </p>
                  <p className="truncate text-xs text-theme-muted">{formatPhotoAddress(photo)}</p>
                  {photo.order_name && (
                    <p className="truncate text-xs text-[var(--accent-primary)]">{photo.order_name}</p>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <p className="mt-3 text-sm text-theme-secondary">
          Vybráno: <strong>{picked.length}</strong> z {photos.length}
        </p>

        <div className="modal-footer mt-4 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="button" onClick={confirm} disabled={picked.length === 0}>
            <ImageIcon className="h-4 w-4" />
            Vložit do deníku ({picked.length})
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

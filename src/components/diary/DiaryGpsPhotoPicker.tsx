import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { fetchArchivePhotos } from '@/lib/gpsFotoarchiv/service'
import { getGpsPhotoUrl } from '@/lib/photos/api'
import { formatDate, formatTime } from '@/constants/workers'
import type { GpsPhoto } from '@/types/photos'

interface DiaryGpsPhotoPickerProps {
  orderId: string
  /** ID právě upravovaného zápisu deníku (pokud existuje) – fotky už přiřazené k němu se nabízí jako dostupné. */
  currentEntryId?: string
  onConfirm: (photos: GpsPhoto[]) => void
  onClose: () => void
}

/**
 * Výběr fotografií z existující galerie modulu Fotodokumentace s GPS.
 * Nejde o novou galerii ani o pořizování/nahrávání fotek z telefonu –
 * pouze výběr z už uložených fotografií (`fetchArchivePhotos` ze
 * skutečného modulu GPS Fotoarchiv), filtrovaných podle zakázky.
 */
export function DiaryGpsPhotoPicker({ orderId, currentEntryId, onConfirm, onClose }: DiaryGpsPhotoPickerProps) {
  const [photos, setPhotos] = useState<GpsPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchArchivePhotos({ orderId })
      .then((data) => {
        if (cancelled) return
        // Nezobrazovat fotky, které jsou už přiřazené k jinému zápisu deníku –
        // aby výběr omylem nepřebral fotku z jiného dne.
        const available = data.filter((photo) => !photo.diary_entry_id || photo.diary_entry_id === currentEntryId)
        setPhotos(available)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Nepodařilo se načíst fotografie.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orderId, currentEntryId])

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleConfirm() {
    const chosen = photos.filter((photo) => selectedIds.has(photo.id))
    onConfirm(chosen)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-lg glass-panel neon-border scrollbar-premium">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-theme-primary">Přidat foto z GPS fotodokumentace</h2>
            <p className="mt-1 text-sm text-theme-muted">
              Vyberte jednu nebo více fotografií z galerie modulu Fotodokumentace s GPS pro tuto zakázku.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-theme-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Načítám fotografie z GPS fotodokumentace…
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && photos.length === 0 && (
          <p className="text-sm text-theme-muted">
            Pro tuto zakázku zatím nejsou v modulu Fotodokumentace s GPS uložené žádné volné fotografie.
          </p>
        )}

        {!loading && photos.length > 0 && (
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto py-1 sm:grid-cols-3">
            {photos.map((photo) => {
              const isSelected = selectedIds.has(photo.id)
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => toggle(photo.id)}
                  className={`rounded-xl border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                      : 'border-[var(--border-glass)] hover:border-[var(--accent-primary)]/50'
                  }`}
                >
                  <img
                    src={getGpsPhotoUrl(photo.file_path)}
                    alt=""
                    className="h-28 w-full rounded-lg object-cover"
                  />
                  <p className="mt-2 text-xs text-theme-primary">
                    {formatDate(photo.captured_date)} · {formatTime(photo.captured_time)}
                  </p>
                  <p className="truncate text-xs text-theme-muted">{photo.address_full || '—'}</p>
                  {photo.creator_name && (
                    <p className="truncate text-xs text-theme-muted">Autor: {photo.creator_name}</p>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="modal-footer pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={selectedIds.size === 0}>
            Přidat vybrané ({selectedIds.size})
          </Button>
        </div>
      </div>
    </div>
  )
}

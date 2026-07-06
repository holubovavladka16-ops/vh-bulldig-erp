import { getGpsPhotoUrl } from '@/lib/photos/api'
import type { GpsPhoto } from '@/types/photos'
import { formatDate, formatTime } from '@/constants/workers'

interface DiaryAutoPhotosProps {
  photos: GpsPhoto[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  loading?: boolean
}

export function DiaryAutoPhotos({ photos, selectedIds, onChange, loading }: DiaryAutoPhotosProps) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-theme-secondary">Fotky z fotodokumentace</p>
        <p className="text-xs text-theme-muted">Automaticky načtené podle zakázky a data. Kliknutím vyberte, které patří k zápisu.</p>
      </div>

      {loading ? (
        <p className="text-sm text-theme-muted">Načítám fotografie…</p>
      ) : photos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-glass)] px-4 py-6 text-center text-sm text-theme-muted">
          Pro tento den nejsou ve fotodokumentaci žádné fotky.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {photos.map((photo) => {
            const selected = selectedIds.includes(photo.id)
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => toggle(photo.id)}
                className={`rounded-xl border p-2 text-left transition-colors ${
                  selected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                    : 'border-[var(--border-glass)] opacity-70 hover:opacity-100'
                }`}
              >
                <img src={getGpsPhotoUrl(photo.file_path)} alt="" className="max-h-32 w-full rounded-lg object-cover" />
                <p className="mt-2 text-xs text-theme-primary">
                  {formatDate(photo.captured_date)} · {formatTime(photo.captured_time)}
                </p>
                <p className="truncate text-xs text-theme-muted">{photo.address_full}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

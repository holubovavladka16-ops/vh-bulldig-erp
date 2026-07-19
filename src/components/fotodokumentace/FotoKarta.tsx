import { formatDate, formatTime } from '@/constants/workers'
import {
  FOTO_APPROVAL_LABELS,
  FOTO_GPS_STATUS_LABELS,
  getTypFotografieLabel,
} from '@/constants/fotodokumentace'
import { getFotoUrl } from '@/lib/fotodokumentace/api'
import type { FotoDokument } from '@/types/fotodokumentace'

interface FotoKartaProps {
  foto: FotoDokument
  onClick: () => void
  view?: 'grid' | 'list'
}

export function FotoKarta({ foto, onClick, view = 'grid' }: FotoKartaProps) {
  const thumb = getFotoUrl(foto.thumbnail_path ?? foto.file_path)

  if (view === 'list') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="neon-border flex w-full gap-3 rounded-xl p-3 text-left transition hover:border-[var(--accent-primary)]"
      >
        <img src={thumb} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-theme-primary">{foto.order_name ?? '—'}</p>
          <p className="text-xs text-theme-muted">
            {formatDate(foto.captured_date)} · {formatTime(foto.captured_time)}
          </p>
          <p className="truncate text-xs text-theme-secondary">{foto.address_full}</p>
          <p className="text-xs text-theme-muted">
            {getTypFotografieLabel(foto.photo_type)} · {foto.creator_name ?? '—'}
          </p>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="neon-border overflow-hidden rounded-xl text-left transition hover:border-[var(--accent-primary)]"
    >
      <img src={thumb} alt="" className="aspect-[4/3] w-full object-cover" />
      <div className="p-2">
        <p className="truncate text-sm font-medium text-theme-primary">{foto.order_name ?? '—'}</p>
        <p className="text-xs text-theme-muted">
          {formatDate(foto.captured_date)} · {formatTime(foto.captured_time)}
        </p>
        <p className="truncate text-xs text-theme-secondary">{foto.address_full}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-theme-muted">
            {FOTO_GPS_STATUS_LABELS[foto.gps_status]}
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-theme-muted">
            {FOTO_APPROVAL_LABELS[foto.approval_status]}
          </span>
        </div>
      </div>
    </button>
  )
}

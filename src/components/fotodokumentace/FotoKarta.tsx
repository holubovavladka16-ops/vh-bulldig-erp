import { Download, Share2 } from 'lucide-react'
import { formatDate, formatTime } from '@/constants/workers'
import {
  FOTO_APPROVAL_LABELS,
  FOTO_GPS_STATUS_LABELS,
  FOTO_SYNC_LABELS,
  getTypFotografieLabel,
} from '@/constants/fotodokumentace'
import { getFotoUrl } from '@/lib/fotodokumentace/api'
import { sdiletFotografii, stahnoutFotografii } from '@/lib/fotodokumentace/share'
import type { FotoDokument } from '@/types/fotodokumentace'

interface FotoKartaProps {
  foto: FotoDokument
  onClick: () => void
  view?: 'grid' | 'list'
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}

export function FotoKarta({
  foto,
  onClick,
  view = 'grid',
  selectable = false,
  selected = false,
  onToggleSelect,
}: FotoKartaProps) {
  const thumb = getFotoUrl(foto.thumbnail_path ?? foto.file_path)
  const isDeleted = Boolean(foto.deleted_at)

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    await sdiletFotografii(foto)
  }

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    await stahnoutFotografii(foto)
  }

  function handleSelect(e: React.MouseEvent) {
    e.stopPropagation()
    onToggleSelect?.(foto.id)
  }

  const badges = (
    <div className="mt-1 flex flex-wrap gap-1">
      {isDeleted && (
        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">Koš</span>
      )}
      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-theme-muted">
        {FOTO_GPS_STATUS_LABELS[foto.gps_status]}
      </span>
      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-theme-muted">
        {FOTO_APPROVAL_LABELS[foto.approval_status]}
      </span>
      {foto.sync_status && foto.sync_status !== 'synced' && (
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
          {FOTO_SYNC_LABELS[foto.sync_status]}
        </span>
      )}
    </div>
  )

  const actions = (
    <div className="flex gap-1">
      <button
        type="button"
        title="Sdílet"
        className="rounded-lg bg-black/50 p-1.5 text-white hover:bg-black/70"
        onClick={handleShare}
      >
        <Share2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Stáhnout"
        className="rounded-lg bg-black/50 p-1.5 text-white hover:bg-black/70"
        onClick={handleDownload}
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  )

  if (view === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        className={`neon-border flex w-full cursor-pointer gap-3 rounded-xl p-3 text-left transition hover:border-[var(--accent-primary)] ${selected ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/50' : ''}`}
      >
        {selectable && (
          <input type="checkbox" checked={selected} onChange={() => {}} onClick={handleSelect} className="mt-4 h-4 w-4" />
        )}
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
          {badges}
        </div>
        <div className="flex shrink-0 flex-col justify-center gap-1">{actions}</div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`neon-border cursor-pointer overflow-hidden rounded-xl text-left transition hover:border-[var(--accent-primary)] ${selected ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/50' : ''}`}
    >
      <div className="relative">
        <img src={thumb} alt="" className="aspect-[4/3] w-full object-cover" />
        {selectable && (
          <button
            type="button"
            className="absolute left-2 top-2 rounded-lg bg-black/60 p-1"
            onClick={handleSelect}
          >
            <input type="checkbox" checked={selected} readOnly className="h-4 w-4" />
          </button>
        )}
        <div className="absolute bottom-2 right-2 flex gap-1">{actions}</div>
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-medium text-theme-primary">{foto.order_name ?? '—'}</p>
        <p className="text-xs text-theme-muted">
          {formatDate(foto.captured_date)} · {formatTime(foto.captured_time)}
        </p>
        <p className="truncate text-xs text-theme-secondary">{foto.address_full}</p>
        {badges}
      </div>
    </div>
  )
}

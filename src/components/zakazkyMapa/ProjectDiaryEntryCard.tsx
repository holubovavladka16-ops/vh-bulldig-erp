import { Camera, ChevronRight } from 'lucide-react'
import { DiaryStatusBadge } from '@/components/zakazkyMapa/DiaryStatusBadge'
import { formatDate } from '@/constants/workers'
import type { ProjectDiaryListItem } from '@/lib/zakazkyMapa/diaryApi'

interface ProjectDiaryEntryCardProps {
  entry: ProjectDiaryListItem
  selected?: boolean
  onSelect: (entryId: string) => void
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getActivitySummary(entry: ProjectDiaryListItem): string {
  return entry.performances_summary.trim() || entry.rough_work_description.trim() || '—'
}

export function ProjectDiaryEntryCard({ entry, selected = false, onSelect }: ProjectDiaryEntryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
        selected
          ? 'border-lime-400/40 bg-lime-400/10'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-theme-primary">{formatDate(entry.entry_date)}</span>
            <DiaryStatusBadge status={entry.entry_status} />
          </div>
          <p className="mt-1 text-xs text-theme-muted">Počasí: {entry.weather || '—'}</p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" aria-hidden="true" />
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-theme-primary">{getActivitySummary(entry)}</p>
      <p className="mt-1 line-clamp-2 text-xs text-theme-muted">{entry.work_description}</p>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-theme-muted">
        <span>Autor: {entry.creator_name ?? '—'}</span>
        <span>Vytvořeno: {formatDateTime(entry.created_at)}</span>
        {entry.photo_count > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            {entry.photo_count} {entry.photo_count === 1 ? 'fotografie' : 'fotografií'}
          </span>
        ) : null}
      </div>
    </button>
  )
}

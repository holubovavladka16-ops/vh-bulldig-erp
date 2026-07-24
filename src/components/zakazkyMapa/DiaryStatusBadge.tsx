import type { DiaryEntryStatus } from '@/constants/diary'
import { DIARY_ENTRY_STATUS_LABELS } from '@/constants/diary'

const STATUS_VARIANTS: Record<
  DiaryEntryStatus,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  draft: 'neutral',
  submitted: 'info',
  pending_review: 'warning',
  approved: 'success',
  returned: 'warning',
  rejected: 'danger',
}

interface DiaryStatusBadgeProps {
  status: DiaryEntryStatus
  className?: string
}

export function DiaryStatusBadge({ status, className = '' }: DiaryStatusBadgeProps) {
  const label = DIARY_ENTRY_STATUS_LABELS[status] ?? status
  const variant = STATUS_VARIANTS[status] ?? 'neutral'

  const colors: Record<typeof variant, string> = {
    success: 'bg-green-500/15 text-green-300 border-green-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    danger: 'bg-red-500/15 text-red-300 border-red-500/30',
    info: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    neutral: 'bg-white/5 text-theme-secondary border-[var(--border-glass)]',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[variant]} ${className}`}
    >
      {label}
    </span>
  )
}

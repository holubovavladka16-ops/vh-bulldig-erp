import type { UserRole } from '@/types'
import { ROLE_COLORS, ROLE_LABELS } from '@/constants/permissions'

interface BadgeProps {
  role: UserRole
}

export function RoleBadge({ role }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}

interface StatusBadgeProps {
  label: string
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

const statusColors: Record<NonNullable<StatusBadgeProps['variant']>, string> = {
  success: 'bg-green-500/15 text-green-400 border border-green-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  danger: 'bg-red-500/15 text-red-400 border border-red-500/30',
  info: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  neutral: 'bg-white/5 text-theme-secondary border border-[var(--border-glass)]',
}

export function StatusBadge({ label, variant = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[variant]}`}>
      {label}
    </span>
  )
}

export function ModuleBadge() {
  return <StatusBadge label="Připravuje se" variant="warning" />
}

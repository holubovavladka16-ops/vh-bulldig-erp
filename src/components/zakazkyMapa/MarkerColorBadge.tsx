import type { ProjectMarkerColor } from '@/types/zakazkyMapa'
import {
  PROJECT_MARKER_COLOR_HEX,
  PROJECT_MARKER_COLOR_LABELS,
} from '@/constants/zakazkyMapa'

interface MarkerColorBadgeProps {
  color: ProjectMarkerColor
  label: string
  className?: string
}

export function MarkerColorBadge({ color, label, className = '' }: MarkerColorBadgeProps) {
  const hex = PROJECT_MARKER_COLOR_HEX[color]

  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
      style={{
        borderColor: `${hex}66`,
        backgroundColor: `${hex}22`,
        color: hex,
      }}
      title={`${PROJECT_MARKER_COLOR_LABELS[color]} – ${label}`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/40"
        style={{ backgroundColor: hex }}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </span>
  )
}

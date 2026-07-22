import { MapPin } from 'lucide-react'
import { MarkerColorBadge } from '@/components/zakazkyMapa/MarkerColorBadge'
import { JOB_ORDER_STATUS_LABELS } from '@/constants/orders'
import { PROJECT_MAP_MISSING_LOCATION_LABEL } from '@/constants/zakazkyMapa'
import { isValidProjectMarkerGps } from '@/lib/zakazkyMapa/markerGps'
import type { ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'

interface ProjectListProps {
  items: ProjectMapMarkerWithOrder[]
  selectedProjectId: string | null
  onSelect: (projectId: string) => void
  loading?: boolean
}

export function ProjectList({ items, selectedProjectId, onSelect, loading = false }: ProjectListProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-theme-muted">
        Načítám zakázky…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-theme-muted">
        Žádné zakázky neodpovídají zadaným filtrům.
      </div>
    )
  }

  return (
    <ul className="scrollbar-premium max-h-[min(72vh,640px)] space-y-2 overflow-y-auto pr-1">
      {items.map((item) => {
        const hasGps = isValidProjectMarkerGps(item.gps_lat, item.gps_lng)
        const selected = selectedProjectId === item.project_id

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.project_id)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                selected
                  ? 'border-lime-400/40 bg-lime-400/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-theme-primary">{item.order.name}</p>
                  <p className="mt-0.5 truncate text-xs text-theme-muted">{item.order.location}</p>
                </div>
                <MapPin
                  className={`mt-0.5 h-4 w-4 shrink-0 ${hasGps ? 'text-lime-300' : 'text-theme-muted'}`}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <MarkerColorBadge color={item.marker_color} label={item.color_label} />
                <span className="text-xs text-theme-muted">
                  {JOB_ORDER_STATUS_LABELS[item.order.status]}
                </span>
              </div>
              {!hasGps ? (
                <p className="mt-2 text-xs text-amber-300/90">{PROJECT_MAP_MISSING_LOCATION_LABEL}</p>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

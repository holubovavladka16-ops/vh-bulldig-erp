import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { MarkerColorBadge } from '@/components/zakazkyMapa/MarkerColorBadge'
import { JOB_ORDER_STATUS_LABELS } from '@/constants/orders'
import { formatDate } from '@/constants/workers'
import type { JobOrderStatus } from '@/types/orders'
import type { ProjectMapMarkerWithOrder } from '@/types/zakazkyMapa'
import { isValidProjectMarkerGps } from '@/lib/zakazkyMapa/markerGps'

interface ProjectMarkerPopupProps {
  item: ProjectMapMarkerWithOrder
  onClose: () => void
  className?: string
}

function getOrderStatusVariant(status: JobOrderStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'aktivni') return 'success'
  if (status === 'pripravuje_se') return 'warning'
  if (status === 'pozastavena') return 'danger'
  if (status === 'archivovana') return 'neutral'
  return 'info'
}

function getPartyLabel(item: ProjectMapMarkerWithOrder): string | null {
  return item.order.investor?.trim() || item.order.client_name?.trim() || null
}

export function ProjectMarkerPopup({ item, onClose, className = '' }: ProjectMarkerPopupProps) {
  const navigate = useNavigate()
  const hasGps = isValidProjectMarkerGps(item.gps_lat, item.gps_lng)
  const party = getPartyLabel(item)

  return (
    <div
      className={`glass-panel neon-border flex max-h-[min(80vh,640px)] flex-col overflow-hidden rounded-2xl ${className}`}
      role="dialog"
      aria-label={`Detail zakázky ${item.order.name}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-theme-primary">{item.order.name}</h3>
          <p className="mt-1 text-sm text-theme-muted">{item.order.location}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 hover:bg-white/5"
          aria-label="Zavřít detail"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="scrollbar-premium space-y-3 overflow-y-auto px-4 py-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={JOB_ORDER_STATUS_LABELS[item.order.status]}
            variant={getOrderStatusVariant(item.order.status)}
          />
          <MarkerColorBadge color={item.marker_color} label={item.color_label} />
        </div>

        <dl className="grid gap-2">
          <div>
            <dt className="text-theme-muted">Místo / adresa</dt>
            <dd className="text-theme-primary">{item.order.location}</dd>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-theme-muted">Zahájení</dt>
              <dd className="text-theme-primary">{formatDate(item.order.start_date)}</dd>
            </div>
            {item.order.end_date ? (
              <div>
                <dt className="text-theme-muted">Ukončení</dt>
                <dd className="text-theme-primary">{formatDate(item.order.end_date)}</dd>
              </div>
            ) : null}
          </div>
          {party ? (
            <div>
              <dt className="text-theme-muted">Investor / objednatel</dt>
              <dd className="text-theme-primary">{party}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-theme-muted">Popis prací</dt>
            <dd className="whitespace-pre-wrap text-theme-primary">{item.order.work_description}</dd>
          </div>
          <div>
            <dt className="text-theme-muted">Poloha na mapě</dt>
            <dd className="text-theme-primary">
              {hasGps
                ? item.is_approximate
                  ? 'Přibližná poloha'
                  : 'Přesná poloha'
                : 'Poloha není doplněna'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <Button
          className="w-full"
          onClick={() => navigate(`/zakazky/${item.order.id}`)}
        >
          Otevřít detail zakázky
        </Button>
      </div>
    </div>
  )
}

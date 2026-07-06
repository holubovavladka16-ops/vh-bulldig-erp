import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  calculateRouteLengthMeters,
  formatGpsAccuracy,
  formatGpsCoordinates,
  formatRouteLength,
  formatSegmentLength,
  getRouteSegments,
} from '@/lib/excavations/geometry'
import type { ExcavationPoint } from '@/types/excavations'

interface RouteSegmentListProps {
  points: ExcavationPoint[]
  onDeletePoint?: (index: number) => void
  showDelete?: boolean
  showGpsDetails?: boolean
}

export function RouteSegmentList({
  points,
  onDeletePoint,
  showDelete = false,
  showGpsDetails = false,
}: RouteSegmentListProps) {
  const segments = getRouteSegments(points)
  const total = calculateRouteLengthMeters(points)

  if (points.length === 0) {
    return (
      <p className="text-sm text-theme-muted">
        Zatím žádné body. Klikněte do mapy, kreslete prstem / myší, nebo použijte GPS / adresy.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {showGpsDetails && points.length > 0 && (
        <dl className="space-y-2 text-sm">
          {points.map((point, index) => (
            <div
              key={index}
              className="rounded-lg border border-[var(--border-glass)] bg-white/5 px-3 py-2"
            >
              <dt className="font-medium text-theme-primary">
                Bod {index + 1}
                {index === 0 ? ' / Start' : index === points.length - 1 && points.length === 2 ? ' / Konec' : ''}
              </dt>
              <dd className="mt-1 space-y-0.5 text-xs">
                {point.label && (
                  <p className="text-theme-secondary">{point.label}</p>
                )}
                <p>
                  <span className="text-theme-muted">GPS: </span>
                  <span className="font-mono text-theme-primary">{formatGpsCoordinates(point)}</span>
                </p>
                {point.accuracy != null && (
                  <p>
                    <span className="text-theme-muted">Přesnost: </span>
                    <span className="text-theme-primary">{formatGpsAccuracy(point.accuracy)}</span>
                  </p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <ul className="space-y-1.5 text-sm">
        {segments.map((seg) => (
          <li
            key={`${seg.fromIndex}-${seg.toIndex}`}
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"
          >
            <span className="text-theme-primary">
              Bod {seg.fromIndex + 1} → Bod {seg.toIndex + 1} ={' '}
              <strong className="text-emerald-400">{formatSegmentLength(seg.meters)} m</strong>
            </span>
            {showDelete && onDeletePoint && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-red-400 hover:text-red-300"
                onClick={() => onDeletePoint(seg.toIndex)}
                title={`Smazat bod ${seg.toIndex + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {points.length >= 2 && (
        <p className="border-t border-[var(--border-glass)] pt-3 text-base font-bold text-emerald-400">
          Celkem: {formatRouteLength(total)}
        </p>
      )}

      {showDelete && points.length > 0 && onDeletePoint && (
        <ul className="space-y-1 text-xs text-theme-muted">
          {points.map((_, index) => (
            <li key={index} className="flex items-center justify-between gap-2">
              <span>
                Bod {index + 1}
                {index === 0 ? ' (start)' : index === points.length - 1 ? ' (konec)' : ''}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300"
                onClick={() => onDeletePoint(index)}
              >
                Smazat
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

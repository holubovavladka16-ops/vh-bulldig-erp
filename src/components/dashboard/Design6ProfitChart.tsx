import type { Design6ProfitPoint } from '@/lib/dashboard/stats'

interface Design6ProfitChartProps {
  points: Design6ProfitPoint[]
  loading?: boolean
}

export function Design6ProfitChart({ points, loading }: Design6ProfitChartProps) {
  const width = 320
  const height = 140
  const padding = { top: 12, right: 8, bottom: 28, left: 8 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const values = points.map((point) => point.profit)
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)))
  const zeroY = padding.top + chartH / 2

  const coords = points.map((point, index) => {
    const x =
      padding.left +
      (points.length <= 1 ? chartW / 2 : (index / (points.length - 1)) * chartW)
    const normalized = point.profit / maxAbs
    const y = zeroY - normalized * (chartH / 2 - 8)
    return { x, y, point }
  })

  const linePath =
    coords.length > 0
      ? coords.map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`).join(' ')
      : ''

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${zeroY} L ${coords[0].x} ${zeroY} Z`
      : ''

  return (
    <div className="design6-profit-chart" aria-label="Graf vývoje zisku">
      <div className="design6-profit-chart__header">
        <h3 className="design6-section-title">Vývoj zisku</h3>
        <span className="design6-profit-chart__hint">Posledních 6 měsíců</span>
      </div>

      {loading ? (
        <p className="design6-profit-chart__loading">Načítání grafu…</p>
      ) : points.length === 0 ? (
        <p className="design6-profit-chart__empty">Zatím nejsou k dispozici data zisku.</p>
      ) : (
        <svg
          className="design6-profit-chart__svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-hidden="true"
        >
          <line
            x1={padding.left}
            y1={zeroY}
            x2={width - padding.right}
            y2={zeroY}
            className="design6-profit-chart__baseline"
          />
          {areaPath && <path d={areaPath} className="design6-profit-chart__area" />}
          {linePath && <path d={linePath} className="design6-profit-chart__line" />}
          {coords.map((coord) => (
            <circle
              key={coord.point.label}
              cx={coord.x}
              cy={coord.y}
              r="3.5"
              className="design6-profit-chart__dot"
            />
          ))}
          {coords.map((coord) => (
            <text
              key={`${coord.point.label}-label`}
              x={coord.x}
              y={height - 8}
              textAnchor="middle"
              className="design6-profit-chart__label"
            >
              {coord.point.label}
            </text>
          ))}
        </svg>
      )}
    </div>
  )
}

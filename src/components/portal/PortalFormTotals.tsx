import type { TaskLineInput, WorkerPriceItem } from '@/types/workers'
import { calculatePerformanceEarnings } from '@/lib/workers/earnings'
import { PRICE_UNIT_LABELS, formatCurrency } from '@/constants/workers'

interface PortalFormTotalsProps {
  taskLines: TaskLineInput[]
  priceItems: WorkerPriceItem[]
  advance: number
  /** Režim dělníka – bez cen, pouze přehled množství */
  workerMode?: boolean
}

export function PortalFormTotals({ taskLines, priceItems, advance, workerMode = false }: PortalFormTotalsProps) {
  const performancesTotal = calculatePerformanceEarnings(taskLines, priceItems)
  const activeLines = taskLines.filter((line) => line.quantity > 0)

  if (workerMode) {
    return (
      <div className="glass-panel neon-border space-y-3 rounded-xl p-4">
        <h3 className="font-semibold text-theme-primary">Váš přehled za den</h3>
        {activeLines.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {activeLines.map((line) => {
              const item = priceItems.find((p) => p.id === line.price_item_id)
              if (!item) return null
              return (
                <li key={line.lineKey ?? line.price_item_id} className="flex justify-between gap-2">
                  <span className="text-theme-secondary">{item.name}</span>
                  <span className="font-medium text-theme-primary">
                    {line.quantity} {PRICE_UNIT_LABELS[item.unit_type].replace('Kč/', '')}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-theme-muted">Zatím žádné výkony.</p>
        )}
        {advance > 0 && (
          <div className="border-t border-[var(--border-glass)] pt-2 text-sm">
            <div className="flex justify-between">
              <span className="text-theme-secondary">Denní záloha</span>
              <span className="font-medium text-theme-primary">{formatCurrency(advance)}</span>
            </div>
          </div>
        )}
        <p className="text-xs text-theme-muted">
          Výdělek vypočítá administrátor podle vašeho ceníku po odeslání formuláře.
        </p>
      </div>
    )
  }

  return (
    <div className="glass-panel neon-border space-y-3 rounded-xl p-4">
      <h3 className="font-semibold text-theme-primary">Automatický výpočet</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-theme-secondary">Součet výkonů</span>
          <span className="font-medium text-theme-primary">{formatCurrency(performancesTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-theme-secondary">Denní záloha</span>
          <span className="font-medium text-theme-primary">{formatCurrency(advance)}</span>
        </div>
        <div className="border-t border-[var(--border-glass)] pt-2 flex justify-between">
          <span className="font-semibold text-theme-primary">Celkový výdělek za den</span>
          <span className="text-xl font-bold text-accent">{formatCurrency(performancesTotal)}</span>
        </div>
      </div>
      <p className="text-xs text-theme-muted">
        Záloha je evidována samostatně a neodečítá se od výdělku.
      </p>
    </div>
  )
}

import type { TaskLineInput, WorkerPriceItem } from '@/types/workers'
import { calculatePerformanceEarnings } from '@/lib/workers/earnings'
import { formatCurrency } from '@/constants/workers'

interface PortalFormTotalsProps {
  taskLines: TaskLineInput[]
  priceItems: WorkerPriceItem[]
  advance: number
}

export function PortalFormTotals({ taskLines, priceItems, advance }: PortalFormTotalsProps) {
  const performancesTotal = calculatePerformanceEarnings(taskLines, priceItems)

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

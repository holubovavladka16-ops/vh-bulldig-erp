import { AlertTriangle, BookOpen, Camera, Coins, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/constants/workers'
import { hasAnyMissingData, listMissingDataMessages, type OrderDaySummary } from '@/lib/dailyCalendar/types'

interface OrderDaySummaryCardProps {
  summary: OrderDaySummary
}

/**
 * Rychlý manažerský přehled jedné zakázky za jeden den – čistě ke čtení.
 * Neobsahuje žádné ruční ovládání, počet/seznam pracovníků, odpracované
 * hodiny ani tlačítka pro otevření zdrojových modulů – přesně dle zadání.
 */
export function OrderDaySummaryCard({ summary }: OrderDaySummaryCardProps) {
  const missing = hasAnyMissingData(summary)

  return (
    <Card className="space-y-4">
      <h3 className="text-lg font-semibold text-theme-primary">{summary.orderName}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-glass)] px-4 py-3">
          <BookOpen className="h-5 w-5 shrink-0 text-theme-muted" />
          <div>
            <p className="text-xs text-theme-muted">Stavební deník</p>
            <p className="font-medium text-theme-primary">{summary.diaryFilled ? 'Vyplněn' : 'Chybí'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-glass)] px-4 py-3">
          <Camera className="h-5 w-5 shrink-0 text-theme-muted" />
          <div>
            <p className="text-xs text-theme-muted">Fotografie</p>
            <p className="font-medium text-theme-primary">{summary.photosCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-glass)] px-4 py-3">
          <Coins className="h-5 w-5 shrink-0 text-theme-muted" />
          <div>
            <p className="text-xs text-theme-muted">Náklady</p>
            <p className="font-medium text-theme-primary">{formatCurrency(summary.costsTotal)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-glass)] px-4 py-3">
          <Wallet className="h-5 w-5 shrink-0 text-theme-muted" />
          <div>
            <p className="text-xs text-theme-muted">Výplaty zaměstnanců</p>
            <p className="font-medium text-theme-primary">{formatCurrency(summary.wagesTotal)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--bg-glass)] px-4 py-3">
        <p className="text-xs text-theme-muted">Denní součet nákladů</p>
        <p className="text-xl font-bold text-[var(--accent-primary)]">{formatCurrency(summary.dailyTotal)}</p>
      </div>

      {missing && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-300">CHYBÍ DATA</p>
            <ul className="mt-1 space-y-0.5 text-sm text-red-200">
              {listMissingDataMessages(summary).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  )
}

import { memo } from 'react'
import { formatCurrency } from '@/constants/workers'
import type { InvoiceableWorkReportLine } from '@/types/invoiceableWorkReports'

interface InvoiceableOrderTotalsSummaryProps {
  lines: InvoiceableWorkReportLine[]
}

/** Průběžné součty podle jednotlivých zakázek – počítáno za běhu z aktuálně načtených řádků. */
function InvoiceableOrderTotalsSummaryComponent({ lines }: InvoiceableOrderTotalsSummaryProps) {
  const byOrder = new Map<string, { name: string; total: number; count: number }>()

  for (const line of lines) {
    const current = byOrder.get(line.order_id) ?? { name: line.order_name ?? 'Neznámá zakázka', total: 0, count: 0 }
    current.total += line.line_total
    current.count += 1
    byOrder.set(line.order_id, current)
  }

  const rows = [...byOrder.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'cs'))
  const grandTotal = rows.reduce((sum, [, v]) => sum + v.total, 0)

  if (rows.length === 0) {
    return <p className="text-sm text-theme-muted">Zatím nejsou přidané žádné řádky.</p>
  }

  return (
    <div className="space-y-2">
      {rows.map(([orderId, v]) => (
        <div
          key={orderId}
          className="flex items-center justify-between rounded-xl border border-[var(--border-glass)] px-4 py-2"
        >
          <div>
            <p className="text-sm font-medium text-theme-primary">{v.name}</p>
            <p className="text-xs text-theme-muted">{v.count}× položka</p>
          </div>
          <p className="font-semibold text-theme-primary">{formatCurrency(v.total)}</p>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl border-t-2 border-[var(--accent-primary)] px-4 pt-3">
        <p className="font-semibold text-theme-primary">Celkem za výkaz</p>
        <p className="text-lg font-bold text-[var(--accent-primary)]">{formatCurrency(grandTotal)}</p>
      </div>
    </div>
  )
}

export const InvoiceableOrderTotalsSummary = memo(InvoiceableOrderTotalsSummaryComponent)

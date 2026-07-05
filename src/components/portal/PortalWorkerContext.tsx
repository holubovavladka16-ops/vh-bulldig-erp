import { Card } from '@/components/ui/Card'
import type { PortalWorker, WorkerPriceItem, PortalDailyAdvance } from '@/types/workers'
import { EMPLOYMENT_TYPE_LABELS, PRICE_UNIT_LABELS, formatCurrency, formatDate } from '@/constants/workers'

interface PortalWorkerContextProps {
  worker: PortalWorker
  priceItems: WorkerPriceItem[]
  advances: PortalDailyAdvance[]
}

export function PortalWorkerContext({ worker, priceItems, advances }: PortalWorkerContextProps) {
  const activeItems = priceItems.filter((i) => i.is_active !== false)

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-theme-primary">Údaje zaměstnance</h2>
      <p className="text-xs text-theme-muted">Tyto údaje nelze upravovat.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoRow label="Jméno" value={worker.first_name} />
        <InfoRow label="Příjmení" value={worker.last_name} />
        <InfoRow label="Pracovní pozice" value={worker.position} />
        <InfoRow label="Pracovní poměr" value={EMPLOYMENT_TYPE_LABELS[worker.employment_type]} />
        <InfoRow label="Zakázka" value={worker.assigned_order || '—'} className="sm:col-span-2" />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-theme-secondary">Osobní ceník</h3>
        {activeItems.length === 0 ? (
          <p className="text-sm text-theme-muted">Ceník není nastaven.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {activeItems.map((item) => (
              <li key={item.id} className="flex justify-between gap-2 text-theme-primary">
                <span>{item.name}</span>
                <span className="shrink-0 text-theme-secondary">
                  {formatCurrency(item.price)} / {PRICE_UNIT_LABELS[item.unit_type].replace('Kč/', '')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-theme-secondary">Přehled denních záloh</h3>
        {advances.length === 0 ? (
          <p className="text-sm text-theme-muted">Zatím žádné zálohy.</p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm scrollbar-premium">
            {advances.map((a) => (
              <li key={a.form_date} className="flex justify-between gap-2">
                <span className="text-theme-primary">{formatDate(a.form_date)}</span>
                <span className="text-accent">{formatCurrency(a.advance)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function InfoRow({
  label,
  value,
  className = '',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="font-medium text-theme-primary">{value}</p>
    </div>
  )
}

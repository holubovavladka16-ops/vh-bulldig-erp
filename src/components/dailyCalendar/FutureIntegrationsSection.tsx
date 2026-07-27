import { StatusBadge } from '@/components/ui/Badge'
import { FUTURE_INTEGRATION_SOURCES } from '@/lib/dailyCalendar/futureIntegrations'

/**
 * Návrhové místo pro budoucí napojení na existující moduly.
 * Zobrazuje pouze názvy tabulek – žádné dotazy do Supabase zde neprobíhají.
 */
export function FutureIntegrationsSection() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {FUTURE_INTEGRATION_SOURCES.map((source) => (
        <li
          key={source.id}
          className="flex flex-col gap-1 rounded-xl border border-[var(--border-glass)] p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-theme-primary">{source.label}</span>
            <StatusBadge
              label={source.connected ? 'Napojeno' : 'Zatím nenapojeno'}
              variant={source.connected ? 'success' : 'neutral'}
            />
          </div>
          <code className="text-xs text-theme-muted">{source.table}</code>
          <p className="text-xs text-theme-secondary">{source.description}</p>
        </li>
      ))}
    </ul>
  )
}

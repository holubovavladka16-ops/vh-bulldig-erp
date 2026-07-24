import { formatDateTime } from '@/constants/workers'
import { INVOICEABLE_HISTORY_ACTION_LABELS, type InvoiceableHistoryEntry } from '@/types/invoiceableWorkReports'

interface InvoiceableHistorySectionProps {
  entries: InvoiceableHistoryEntry[]
  loading: boolean
}

function formatDetailValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(', ')
  }
  return String(value)
}

/** Historie změn – pouze pro čtení, žádná možnost ručně upravovat ani mazat. */
export function InvoiceableHistorySection({ entries, loading }: InvoiceableHistorySectionProps) {
  if (loading) {
    return <p className="text-sm text-theme-muted">Načítám historii…</p>
  }

  if (entries.length === 0) {
    return <p className="text-sm text-theme-muted">Zatím žádná historie změn.</p>
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-xl border border-[var(--border-glass)] px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-theme-primary">
              {INVOICEABLE_HISTORY_ACTION_LABELS[entry.action]}
            </span>
            <span className="text-xs text-theme-muted">{formatDateTime(entry.changed_at)}</span>
          </div>
          <p className="text-xs text-theme-muted">{entry.changed_by_name ?? 'Neznámý uživatel'}</p>
          {entry.details && (entry.details as { old?: unknown }).old != null && (
            <p className="mt-1 text-xs text-theme-secondary">
              Původní hodnota: {formatDetailValue((entry.details as { old?: unknown }).old)}
            </p>
          )}
          {entry.details && (entry.details as { new?: unknown }).new != null && (
            <p className="text-xs text-theme-secondary">
              Nová hodnota: {formatDetailValue((entry.details as { new?: unknown }).new)}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

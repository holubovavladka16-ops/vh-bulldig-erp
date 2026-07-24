import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DataTable, DataTableCell, DataTableRow } from '@/components/ui/DataTable'
import { MarkerColorBadge } from '@/components/zakazkyMapa/MarkerColorBadge'
import {
  fetchMarkerColorHistory,
  formatMarkerColorState,
} from '@/lib/zakazkyMapa/markerColorHistory'
import {
  PROJECT_MARKER_CHANGE_TYPE_LABELS,
  PROJECT_MARKER_COLOR_LABELS,
} from '@/constants/zakazkyMapa'
import { formatDateTime } from '@/constants/workers'
import type { ProjectMarkerStatusHistory } from '@/types/zakazkyMapa'

interface ProjectMarkerColorHistoryTableProps {
  projectId: string
  refreshToken?: number
  compact?: boolean
}

function formatHistoryState(
  color: ProjectMarkerStatusHistory['old_color'] | ProjectMarkerStatusHistory['new_color'],
  label?: string | null
): string {
  if (!color) return '—'
  const colorName = PROJECT_MARKER_COLOR_LABELS[color]
  const text = formatMarkerColorState(color, label)
  return text === color ? colorName : `${colorName} – ${text}`
}

export function ProjectMarkerColorHistoryTable({
  projectId,
  refreshToken = 0,
  compact = false,
}: ProjectMarkerColorHistoryTableProps) {
  const [entries, setEntries] = useState<ProjectMarkerStatusHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError('')
    try {
      setEntries(await fetchMarkerColorHistory(projectId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení historie se nezdařilo')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        <p>{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Zkusit znovu
        </Button>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-theme-muted">
        Zatím není zaznamenána žádná změna barvy špendlíku.
      </p>
    )
  }

  const columns = compact
    ? [
        { key: 'date', label: 'Datum' },
        { key: 'new', label: 'Nový stav' },
        { key: 'type', label: 'Typ' },
      ]
    : [
        { key: 'date', label: 'Datum' },
        { key: 'user', label: 'Uživatel' },
        { key: 'old', label: 'Původní stav' },
        { key: 'new', label: 'Nový stav' },
        { key: 'reason', label: 'Důvod' },
        { key: 'type', label: 'Typ' },
      ]

  return (
    <DataTable columns={columns} isEmpty={false}>
      {entries.map((entry) => (
        <DataTableRow key={entry.id}>
          <DataTableCell>{formatDateTime(entry.created_at)}</DataTableCell>
          {!compact ? (
            <DataTableCell>{entry.changed_by_name ?? (entry.change_type === 'auto' ? 'Systém' : '—')}</DataTableCell>
          ) : null}
          {!compact ? (
            <DataTableCell>{formatHistoryState(entry.old_color, null)}</DataTableCell>
          ) : null}
          <DataTableCell>
            <MarkerColorBadge color={entry.new_color} label={entry.color_label} />
          </DataTableCell>
          {!compact ? (
            <DataTableCell className="max-w-xs whitespace-normal">
              {entry.reason?.trim() || '—'}
            </DataTableCell>
          ) : null}
          <DataTableCell>{PROJECT_MARKER_CHANGE_TYPE_LABELS[entry.change_type]}</DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  )
}

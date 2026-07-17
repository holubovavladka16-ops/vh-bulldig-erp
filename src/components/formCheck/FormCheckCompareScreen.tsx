import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableCell, DataTableRow } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { sortCompareItems } from '@/lib/formCheck/compare'
import { formatDateCs } from '@/lib/formCheck/normalize'
import type { CompareItem, CompareItemStatus, FormCheckComparisonResult, FormCheckContext } from '@/types/formCheck'

interface FormCheckCompareScreenProps {
  context: FormCheckContext
  result: FormCheckComparisonResult
  previewUrl?: string | null
  saving?: boolean
  onConfirm: () => void
  onRetake: () => void
  onCancel: () => void
}

const STATUS_LABELS: Record<CompareItemStatus, string> = {
  match: 'Shoda',
  mismatch: 'Neshoda',
  missing_in_erp: 'Chybí v ERP',
  missing_on_form: 'Chybí na formuláři',
  low_confidence: 'Ruční kontrola',
  not_compared: 'Neporovnáno',
}

const STATUS_VARIANTS: Record<
  CompareItemStatus,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  match: 'success',
  mismatch: 'danger',
  missing_in_erp: 'warning',
  missing_on_form: 'warning',
  low_confidence: 'info',
  not_compared: 'neutral',
}

function formatConfidence(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value * 100)} %`
}

function CompareItemsTable({
  items,
  showMatches,
}: {
  items: CompareItem[]
  showMatches: boolean
}) {
  const sorted = useMemo(() => sortCompareItems(items), [items])
  const visible = showMatches ? sorted : sorted.filter((i) => i.status !== 'match')

  const columns = [
    { key: 'date', label: 'Datum' },
    { key: 'field', label: 'Pole' },
    { key: 'erp', label: 'ERP' },
    { key: 'form', label: 'Formulář' },
    { key: 'status', label: 'Stav' },
    { key: 'confidence', label: 'OCR confidence' },
  ]

  return (
    <DataTable columns={columns} isEmpty={visible.length === 0} emptyMessage="Žádné položky k zobrazení">
      {visible.map((item, index) => (
        <DataTableRow key={`${item.date}-${item.field}-${index}`}>
          <DataTableCell>
            {item.date === 'součet' ? 'Součet' : formatDateCs(item.date)}
          </DataTableCell>
          <DataTableCell>{item.fieldLabel}</DataTableCell>
          <DataTableCell>{item.erpValue}</DataTableCell>
          <DataTableCell>{item.formValue}</DataTableCell>
          <DataTableCell>
            <StatusBadge label={STATUS_LABELS[item.status]} variant={STATUS_VARIANTS[item.status]} />
            {item.status === 'low_confidence' && (
              <p className="mt-1 text-xs text-blue-300">Nutná ruční kontrola – OCR si není jisté.</p>
            )}
          </DataTableCell>
          <DataTableCell>{formatConfidence(item.confidence)}</DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  )
}

export function FormCheckCompareScreen({
  context,
  result,
  previewUrl,
  saving = false,
  onConfirm,
  onRetake,
  onCancel,
}: FormCheckCompareScreenProps) {
  const [showAll, setShowAll] = useState(false)
  const [matchesCollapsed, setMatchesCollapsed] = useState(true)

  const isMatch = result.outcome === 'match'
  const isManualReview = result.outcome === 'manual_review'
  const matchItems = result.items.filter((i) => i.status === 'match')
  const diffItems = result.items.filter((i) => i.status !== 'match')

  return (
    <div className="space-y-4">
      <Card
        className={
          isMatch
            ? 'border-green-500/40 bg-green-500/10'
            : isManualReview
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-red-500/40 bg-red-500/10'
        }
      >
        <div className="flex items-start gap-3">
          {isMatch ? (
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-400" />
          ) : isManualReview ? (
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
          ) : (
            <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />
          )}
          <div>
            <h3
              className={`text-xl font-bold ${
                isMatch ? 'text-green-300' : isManualReview ? 'text-amber-300' : 'text-red-300'
              }`}
            >
              {isMatch
                ? 'SHODA – všechny přečtené údaje odpovídají docházce v ERP.'
                : isManualReview
                  ? 'RUČNÍ KONTROLA – některé položky vyžadují ověření.'
                  : 'NESHODA – byly nalezeny rozdíly.'}
            </h3>
            <p className="mt-2 text-sm text-theme-secondary">
              Formulář {context.formNumber} · {context.workerName} · {context.periodLabel}
            </p>

            {isMatch ? (
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>Porovnaných dnů: <strong>{result.comparedDays}</strong></div>
                <div>Porovnaných položek: <strong>{result.comparedItems}</strong></div>
                <div>Hodiny podle formuláře: <strong>{result.formTotalHours ?? '—'} h</strong></div>
                <div>Hodiny podle ERP: <strong>{result.erpTotalHours ?? '—'} h</strong></div>
              </dl>
            ) : (
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>Počet rozdílů: <strong>{result.differenceCount}</strong></div>
                <div>Porovnaných dnů: <strong>{result.comparedDays}</strong></div>
                <div>Hodiny formulář: <strong>{result.formTotalHours ?? '—'} h</strong></div>
                <div>Hodiny ERP: <strong>{result.erpTotalHours ?? '—'} h</strong></div>
              </dl>
            )}
          </div>
        </div>
      </Card>

      {previewUrl && (
        <img
          src={previewUrl}
          alt={`Fotografie formuláře ${context.formNumber}`}
          className="max-h-40 w-full rounded-xl border border-[var(--border-glass)] object-contain"
        />
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-theme-primary">Tabulka rozdílů</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={showAll ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowAll(true)}
            >
              Zobrazit všechny položky
            </Button>
            <Button
              variant={!showAll ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowAll(false)}
            >
              Zobrazit pouze rozdíly
            </Button>
          </div>
        </div>

        <CompareItemsTable items={diffItems.length > 0 ? diffItems : result.items} showMatches={showAll} />

        {showAll && matchItems.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3 text-left text-sm font-medium text-theme-primary"
              onClick={() => setMatchesCollapsed((v) => !v)}
            >
              {matchesCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Shodné položky ({matchItems.length})
            </button>
            {!matchesCollapsed && (
              <div className="mt-3">
                <CompareItemsTable items={matchItems} showMatches />
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button variant="secondary" size="lg" onClick={onCancel} disabled={saving}>
          Zrušit
        </Button>
        <Button variant="secondary" size="lg" onClick={onRetake} disabled={saving}>
          Vyfotit znovu
        </Button>
        <Button size="lg" onClick={onConfirm} loading={saving}>
          Potvrdit kontrolu
        </Button>
      </div>
    </div>
  )
}

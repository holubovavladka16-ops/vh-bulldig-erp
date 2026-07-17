import { useMemo } from 'react'
import { DataTable, DataTableCell, DataTableRow } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { sortCompareItems } from '@/lib/formCheck/compare'
import { formatDateCs } from '@/lib/formCheck/normalize'
import type { CompareItemStatus, FormCheckComparisonResult } from '@/types/formCheck'

interface FormCheckCompareTableProps {
  comparison: FormCheckComparisonResult
  showMatches?: boolean
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

export function FormCheckCompareTable({
  comparison,
  showMatches = false,
}: FormCheckCompareTableProps) {
  const visible = useMemo(() => {
    const sorted = sortCompareItems(comparison.items)
    return showMatches ? sorted : sorted.filter((i) => i.status !== 'match')
  }, [comparison.items, showMatches])

  if (visible.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Žádné rozdíly mezi formulářem a docházkou nebyly nalezeny.
      </p>
    )
  }

  const columns = [
    { key: 'date', label: 'Datum' },
    { key: 'field', label: 'Pole' },
    { key: 'erp', label: 'Docházka' },
    { key: 'form', label: 'Formulář' },
    { key: 'status', label: 'Stav' },
    { key: 'confidence', label: 'OCR confidence' },
  ]

  return (
    <DataTable
      columns={columns}
      isEmpty={visible.length === 0}
      emptyMessage="Žádné položky k zobrazení"
    >
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
          </DataTableCell>
          <DataTableCell>{formatConfidence(item.confidence)}</DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  )
}

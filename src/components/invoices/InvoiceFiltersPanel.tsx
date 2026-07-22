import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { INVOICE_STATUS_LABELS, type InvoiceFilters, type IssuedInvoiceStatus } from '@/types/invoices'

interface InvoiceFiltersPanelProps {
  filters: InvoiceFilters
  onChange: (filters: InvoiceFilters) => void
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Všechny stavy' },
  ...(Object.entries(INVOICE_STATUS_LABELS) as [IssuedInvoiceStatus, string][]).map(([value, label]) => ({
    value,
    label,
  })),
]

export function InvoiceFiltersPanel({ filters, onChange }: InvoiceFiltersPanelProps) {
  return (
    <Card className="mb-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Input
          label="Vyhledávání"
          placeholder="Číslo, IČO, firma, částka, datum…"
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        />
        <Select
          label="Stav"
          options={STATUS_OPTIONS}
          value={filters.status ?? ''}
          onChange={(e) => onChange({ ...filters, status: (e.target.value as IssuedInvoiceStatus) || undefined })}
        />
        <Input
          label="Datum od"
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
        />
        <Input
          label="Datum do"
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
        />
      </div>
    </Card>
  )
}

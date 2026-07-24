import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { ReceiptFilters } from '@/types/receipts'

interface ReceiptFiltersPanelProps {
  filters: ReceiptFilters
  orderOptions: { value: string; label: string }[]
  onChange: (filters: ReceiptFilters) => void
}

export function ReceiptFiltersPanel({ filters, orderOptions, onChange }: ReceiptFiltersPanelProps) {
  const filterOrderOptions = [{ value: '', label: 'Všechny zakázky' }, ...orderOptions]

  return (
    <Card className="mb-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Select
          label="Zakázka"
          options={filterOrderOptions}
          value={filters.orderId ?? ''}
          onChange={(e) => onChange({ ...filters, orderId: e.target.value || undefined })}
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

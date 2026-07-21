import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import type { GpsFotoarchivFilters } from '@/types/gpsFotoarchiv'
import type { AuthorOption } from '@/types/gpsFotoarchiv'

interface GfaFiltersBarProps {
  filters: GpsFotoarchivFilters
  orderOptions: { value: string; label: string }[]
  authorOptions: AuthorOption[]
  onChange: (filters: GpsFotoarchivFilters) => void
}

export function GfaFiltersBar({ filters, orderOptions, authorOptions, onChange }: GfaFiltersBarProps) {
  return (
    <Card className="mb-4 grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-5">
      <Input
        label="Hledat"
        placeholder="Název, adresa, poznámka…"
        value={filters.search ?? ''}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <Select
        label="Zakázka"
        value={filters.orderId ?? ''}
        onChange={(e) => onChange({ ...filters, orderId: e.target.value || undefined })}
        options={[{ value: '', label: 'Všechny' }, ...orderOptions]}
      />
      <Select
        label="Autor"
        value={filters.createdBy ?? ''}
        onChange={(e) => onChange({ ...filters, createdBy: e.target.value || undefined })}
        options={[{ value: '', label: 'Všichni' }, ...authorOptions]}
      />
      <Input
        label="Od data"
        type="date"
        value={filters.dateFrom ?? ''}
        onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
      />
      <Input
        label="Do data"
        type="date"
        value={filters.dateTo ?? ''}
        onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
      />
    </Card>
  )
}

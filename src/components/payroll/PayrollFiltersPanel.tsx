import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import type { PayrollFilters } from '@/types/payroll'

interface PayrollFiltersProps {
  filters: PayrollFilters
  onChange: (patch: Partial<PayrollFilters>) => void
  workers: { id: string; label: string }[]
}

const MONTH_OPTIONS = [
  { value: '1', label: 'Leden' },
  { value: '2', label: 'Únor' },
  { value: '3', label: 'Březen' },
  { value: '4', label: 'Duben' },
  { value: '5', label: 'Květen' },
  { value: '6', label: 'Červen' },
  { value: '7', label: 'Červenec' },
  { value: '8', label: 'Srpen' },
  { value: '9', label: 'Září' },
  { value: '10', label: 'Říjen' },
  { value: '11', label: 'Listopad' },
  { value: '12', label: 'Prosinec' },
]

function buildYearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear()
  const years: { value: string; label: string }[] = []
  for (let y = current + 1; y >= current - 5; y -= 1) {
    years.push({ value: String(y), label: String(y) })
  }
  return years
}

export function PayrollFiltersPanel({ filters, onChange, workers }: PayrollFiltersProps) {
  const workerOptions = [{ value: '', label: 'Všichni zaměstnanci' }, ...workers.map((w) => ({ value: w.id, label: w.label }))]

  return (
    <Card className="mb-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative md:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-[2.45rem] h-4 w-4 text-theme-muted" />
          <Input
            label="Jméno zaměstnance"
            value={filters.search ?? ''}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Hledat podle jména…"
            className="pl-9"
          />
        </div>
        <Select
          label="Zaměstnanec"
          options={workerOptions}
          value={filters.workerId ?? ''}
          onChange={(e) => onChange({ workerId: e.target.value || undefined })}
        />
        <Select
          label="Měsíc"
          options={MONTH_OPTIONS}
          value={String(filters.month)}
          onChange={(e) => onChange({ month: Number(e.target.value) })}
        />
        <Select
          label="Rok"
          options={buildYearOptions()}
          value={String(filters.year)}
          onChange={(e) => onChange({ year: Number(e.target.value) })}
        />
      </div>
    </Card>
  )
}

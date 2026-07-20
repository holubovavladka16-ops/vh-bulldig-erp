import { Select } from '@/components/ui/Select'
import type { FdgFilters } from '@/types/fotodokumentaceGps'

interface FdgFiltersPanelProps {
  filters: FdgFilters
  orderOptions: { value: string; label: string }[]
  workerOptions: { value: string; label: string }[]
  onChange: (filters: FdgFilters) => void
}

export function FdgFiltersPanel({ filters, orderOptions, workerOptions, onChange }: FdgFiltersPanelProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Select
        label="Zakázka"
        value={filters.orderId ?? ''}
        onChange={(e) => onChange({ ...filters, orderId: e.target.value || undefined })}
        options={[{ value: '', label: 'Všechny zakázky' }, ...orderOptions]}
      />
      <Select
        label="Zaměstnanec"
        value={filters.workerId ?? ''}
        onChange={(e) => onChange({ ...filters, workerId: e.target.value || undefined })}
        options={[{ value: '', label: 'Všichni' }, ...workerOptions]}
      />
      <Select
        label="GPS"
        value={filters.gpsFilter ?? 'all'}
        onChange={(e) =>
          onChange({ ...filters, gpsFilter: e.target.value as FdgFilters['gpsFilter'] })
        }
        options={[
          { value: 'all', label: 'Vše' },
          { value: 'with_gps', label: 'S GPS' },
          { value: 'without_gps', label: 'Bez GPS' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          <span className="mb-1 block text-theme-muted">Od</span>
          <input
            type="date"
            className="w-full rounded-lg border border-[var(--border-glass)] bg-white/5 px-3 py-2 text-sm"
            value={filters.dateFrom ?? ''}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-theme-muted">Do</span>
          <input
            type="date"
            className="w-full rounded-lg border border-[var(--border-glass)] bg-white/5 px-3 py-2 text-sm"
            value={filters.dateTo ?? ''}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
          />
        </label>
      </div>
    </div>
  )
}

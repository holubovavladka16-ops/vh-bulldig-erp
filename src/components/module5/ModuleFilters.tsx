import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import type { ModuleListFilters } from '@/lib/workers/module5'
import type { WorkerReportStatus, AttendanceStatus } from '@/types/workers'
import { WORKER_REPORT_STATUS_LABELS } from '@/constants/workers'
import { ATTENDANCE_STATUS_OPTIONS } from '@/constants/attendance'

interface ModuleFiltersProps {
  filters: ModuleListFilters
  onChange: (patch: Partial<ModuleListFilters>) => void
  workers: { id: string; label: string }[]
  orders: { id: string; label: string }[]
  showStatus?: boolean
  showAttendanceStatus?: boolean
}

const sortOptions = [
  { value: 'date', label: 'Datum' },
  { value: 'worker', label: 'Zaměstnanec' },
  { value: 'order', label: 'Zakázka' },
]

const sortDirOptions = [
  { value: 'desc', label: 'Sestupně' },
  { value: 'asc', label: 'Vzestupně' },
]

const statusOptions = [
  { value: '', label: 'Všechny stavy' },
  ...(Object.keys(WORKER_REPORT_STATUS_LABELS) as WorkerReportStatus[]).map((k) => ({
    value: k,
    label: WORKER_REPORT_STATUS_LABELS[k],
  })),
]

export function ModuleFilters({
  filters,
  onChange,
  workers,
  orders,
  showStatus = false,
  showAttendanceStatus = false,
}: ModuleFiltersProps) {
  const workerOptions = [{ value: '', label: 'Všichni zaměstnanci' }, ...workers.map((w) => ({ value: w.id, label: w.label }))]
  const orderOptions = [{ value: '', label: 'Všechny zakázky' }, ...orders.map((o) => ({ value: o.id, label: o.label }))]

  return (
    <Card className="mb-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative md:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-[2.45rem] h-4 w-4 text-theme-muted" />
          <Input
            label="Vyhledávání"
            value={filters.search ?? ''}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Zaměstnanec nebo zakázka…"
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
          label="Zakázka"
          options={orderOptions}
          value={filters.orderName ?? ''}
          onChange={(e) => onChange({ orderName: e.target.value || undefined })}
        />
        {showStatus && (
          <Select
            label="Stav"
            options={statusOptions}
            value={filters.status ?? ''}
            onChange={(e) => onChange({ status: (e.target.value as WorkerReportStatus) || '' })}
          />
        )}
        {showAttendanceStatus && (
          <Select
            label="Stav docházky"
            options={[{ value: '', label: 'Všechny stavy' }, ...ATTENDANCE_STATUS_OPTIONS]}
            value={filters.attendanceStatus ?? ''}
            onChange={(e) => onChange({ attendanceStatus: (e.target.value as AttendanceStatus) || '' })}
          />
        )}
        <Input
          label="Období od"
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ dateFrom: e.target.value || undefined })}
        />
        <Input
          label="Období do"
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ dateTo: e.target.value || undefined })}
        />
        <Select
          label="Řazení"
          options={sortOptions}
          value={filters.sortBy ?? 'date'}
          onChange={(e) => onChange({ sortBy: e.target.value as ModuleListFilters['sortBy'] })}
        />
        <Select
          label="Směr"
          options={sortDirOptions}
          value={filters.sortDir ?? 'desc'}
          onChange={(e) => onChange({ sortDir: e.target.value as ModuleListFilters['sortDir'] })}
        />
      </div>
    </Card>
  )
}

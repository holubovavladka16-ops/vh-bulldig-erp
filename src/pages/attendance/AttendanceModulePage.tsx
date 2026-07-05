import { useCallback, useEffect, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { ModuleFilters } from '@/components/module5/ModuleFilters'
import { fetchAllAttendance, fetchDistinctOrders, type AttendanceListRecord, type ModuleListFilters } from '@/lib/workers/module5'
import { fetchWorkers } from '@/lib/workers/api'
import { downloadCsv } from '@/lib/export'
import { formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'

export function AttendanceModulePage() {
  const [records, setRecords] = useState<AttendanceListRecord[]>([])
  const [workers, setWorkers] = useState<{ id: string; label: string }[]>([])
  const [orders, setOrders] = useState<{ id: string; label: string }[]>([])
  const [filters, setFilters] = useState<ModuleListFilters>({ sortBy: 'date', sortDir: 'desc' })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRecords(await fetchAllAttendance(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchWorkers('vse').then((list) =>
      setWorkers(list.map((w) => ({ id: w.id, label: `${w.last_name} ${w.first_name}` })))
    )
    fetchDistinctOrders().then(setOrders)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  function handleExport() {
    downloadCsv(
      'dochazka.csv',
      ['Datum', 'Zaměstnanec', 'Zakázka', 'Začátek', 'Konec', 'Přestávka', 'Hodiny'],
      records.map((r) => [
        formatDate(r.attendance_date),
        `${r.worker_last_name} ${r.worker_first_name}`,
        r.order_name || '',
        r.work_start ? formatTimeForInput(r.work_start) : '',
        r.work_end ? formatTimeForInput(r.work_end) : '',
        r.break_minutes ? `${r.break_minutes} min` : '',
        String(r.hours),
      ])
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title="Docházka zaměstnanců"
        description="Evidence odpracovaného času z odeslaných formulářů. Výkon se zde nepřepočítává."
        action={
          <Button variant="secondary" onClick={handleExport} disabled={records.length === 0}>
            <FileSpreadsheet className="h-4 w-4" />
            Export do Excelu
          </Button>
        }
      />

      <ModuleFilters
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        workers={workers}
        orders={orders}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'Datum' },
            { key: 'worker', label: 'Zaměstnanec' },
            { key: 'order', label: 'Zakázka' },
            { key: 'start', label: 'Začátek' },
            { key: 'end', label: 'Konec' },
            { key: 'break', label: 'Přestávka' },
            { key: 'hours', label: 'Celkem hodin' },
          ]}
          isEmpty={records.length === 0}
          emptyMessage="Žádné záznamy docházky."
        >
          {records.map((r) => (
            <DataTableRow key={r.id}>
              <DataTableCell>{formatDate(r.attendance_date)}</DataTableCell>
              <DataTableCell>{r.worker_last_name} {r.worker_first_name}</DataTableCell>
              <DataTableCell>{r.order_name || '—'}</DataTableCell>
              <DataTableCell>{r.work_start ? formatTimeForInput(r.work_start) : '—'}</DataTableCell>
              <DataTableCell>{r.work_end ? formatTimeForInput(r.work_end) : '—'}</DataTableCell>
              <DataTableCell>{r.break_minutes ? `${r.break_minutes} min` : '—'}</DataTableCell>
              <DataTableCell>{r.hours} h</DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </AppLayout>
  )
}

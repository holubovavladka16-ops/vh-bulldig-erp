import { useEffect, useState } from 'react'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { fetchAttendance } from '@/lib/workers/api'
import type { WorkerAttendanceRecord } from '@/types/workers'
import { formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'

interface AttendanceTabProps {
  workerId: string
}

export function AttendanceTab({ workerId }: AttendanceTabProps) {
  const [records, setRecords] = useState<WorkerAttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAttendance(workerId).then(setRecords).finally(() => setLoading(false))
  }, [workerId])

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" /></div>
  }

  return (
    <DataTable
      columns={[
        { key: 'date', label: 'Datum' },
        { key: 'order', label: 'Zakázka' },
        { key: 'start', label: 'Začátek' },
        { key: 'end', label: 'Konec' },
        { key: 'break', label: 'Přestávka' },
        { key: 'hours', label: 'Hodiny' },
      ]}
      isEmpty={records.length === 0}
      emptyMessage="Žádné záznamy docházky."
    >
      {records.map((r) => (
        <DataTableRow key={r.id}>
          <DataTableCell>{formatDate(r.attendance_date)}</DataTableCell>
          <DataTableCell>{r.order_name || '—'}</DataTableCell>
          <DataTableCell>{r.work_start ? formatTimeForInput(r.work_start) : '—'}</DataTableCell>
          <DataTableCell>{r.work_end ? formatTimeForInput(r.work_end) : '—'}</DataTableCell>
          <DataTableCell>{r.break_minutes ? `${r.break_minutes} min` : '—'}</DataTableCell>
          <DataTableCell>{r.hours} h</DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  )
}

import { useEffect, useState } from 'react'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { portalGetAttendance } from '@/lib/workers/module5'
import type { PortalAttendanceRecord } from '@/types/workers'
import { formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'

interface PortalAttendanceTabProps {
  token: string
}

export function PortalAttendanceTab({ token }: PortalAttendanceTabProps) {
  const [records, setRecords] = useState<PortalAttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    portalGetAttendance(token).then(setRecords).finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-theme-muted">
        Docházka slouží pouze jako evidence odpracovaného času. Výdělek se počítá z denního formuláře.
      </p>
      <DataTable
        columns={[
          { key: 'date', label: 'Datum' },
          { key: 'order', label: 'Zakázka' },
          { key: 'start', label: 'Začátek' },
          { key: 'end', label: 'Konec' },
          { key: 'break', label: 'Přestávka' },
          { key: 'hours', label: 'Celkem hodin' },
        ]}
        isEmpty={records.length === 0}
        emptyMessage="Zatím nemáte žádnou docházku."
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
    </div>
  )
}

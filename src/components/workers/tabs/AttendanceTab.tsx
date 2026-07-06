import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { AttendanceFormModal } from '@/components/attendance/AttendanceFormModal'
import { useAuth } from '@/context/AuthContext'
import { upsertAttendanceRecord } from '@/lib/attendance/api'
import { fetchAttendance } from '@/lib/workers/api'
import { fetchDistinctOrders } from '@/lib/workers/module5'
import { ATTENDANCE_STATUS_LABELS, attendanceSourceLabel } from '@/constants/attendance'
import type { WorkerAttendanceRecord, AttendanceUpsertInput } from '@/types/workers'
import { formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'

interface AttendanceTabProps {
  workerId: string
  workerLabel: string
  isAdmin?: boolean
}

export function AttendanceTab({ workerId, workerLabel, isAdmin = false }: AttendanceTabProps) {
  const { user } = useAuth()
  const [records, setRecords] = useState<WorkerAttendanceRecord[]>([])
  const [orders, setOrders] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRecords(await fetchAttendance(workerId))
    } finally {
      setLoading(false)
    }
  }, [workerId])

  useEffect(() => {
    fetchDistinctOrders().then(setOrders)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(data: AttendanceUpsertInput) {
    if (!user) throw new Error('Nejste přihlášeni')
    await upsertAttendanceRecord({ ...data, worker_id: workerId }, user.id)
    await load()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div>
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <Button type="button" size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Nový zápis
          </Button>
        </div>
      )}

      <DataTable
        columns={[
          { key: 'date', label: 'Datum' },
          { key: 'order', label: 'Zakázka' },
          { key: 'status', label: 'Stav' },
          { key: 'start', label: 'Začátek' },
          { key: 'end', label: 'Konec' },
          { key: 'break', label: 'Přestávka' },
          { key: 'hours', label: 'Hodiny' },
          { key: 'source', label: 'Zdroj' },
        ]}
        isEmpty={records.length === 0}
        emptyMessage="Žádné záznamy docházky."
      >
        {records.map((r) => (
          <DataTableRow key={r.id}>
            <DataTableCell>{formatDate(r.attendance_date)}</DataTableCell>
            <DataTableCell>{r.order_name || '—'}</DataTableCell>
            <DataTableCell>{ATTENDANCE_STATUS_LABELS[r.attendance_status ?? 'pritomen']}</DataTableCell>
            <DataTableCell>{r.work_start ? formatTimeForInput(r.work_start) : '—'}</DataTableCell>
            <DataTableCell>{r.work_end ? formatTimeForInput(r.work_end) : '—'}</DataTableCell>
            <DataTableCell>{r.break_minutes ? `${r.break_minutes} min` : '—'}</DataTableCell>
            <DataTableCell>{r.hours} h</DataTableCell>
            <DataTableCell>{attendanceSourceLabel(r.form_id)}</DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {isAdmin && (
        <AttendanceFormModal
          open={modalOpen}
          workers={[{ id: workerId, label: workerLabel }]}
          orders={orders}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSave}
        />
      )}
    </div>
  )
}

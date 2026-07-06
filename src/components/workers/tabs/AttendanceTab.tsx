import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { AttendanceFormModal } from '@/components/attendance/AttendanceFormModal'
import { useAuth } from '@/context/AuthContext'
import { upsertAttendanceRecord } from '@/lib/attendance/api'
import { fetchAttendance } from '@/lib/workers/api'
import { fetchActiveJobOrders } from '@/lib/orders/api'
import { attendanceSourceLabel } from '@/constants/attendance'
import type { WorkerAttendanceRecord, AttendanceUpsertInput } from '@/types/workers'
import { formatCurrency, formatDate } from '@/constants/workers'
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
    fetchActiveJobOrders().then((list) =>
      setOrders(list.map((o) => ({ id: o.id, label: `${o.name}${o.location ? ` (${o.location})` : ''}` })))
    )
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
          { key: 'time', label: 'Prac. doba' },
          { key: 'hours', label: 'Hodiny' },
          { key: 'advance', label: 'Záloha' },
          { key: 'note', label: 'Poznámka' },
          { key: 'source', label: 'Zdroj' },
        ]}
        isEmpty={records.length === 0}
        emptyMessage="Žádné záznamy docházky."
      >
        {records.map((r) => (
          <DataTableRow key={r.id}>
            <DataTableCell>{formatDate(r.attendance_date)}</DataTableCell>
            <DataTableCell>{r.order_name || '—'}</DataTableCell>
            <DataTableCell className="whitespace-nowrap text-sm">
              {r.work_start && r.work_end
                ? `${formatTimeForInput(r.work_start)}–${formatTimeForInput(r.work_end)}`
                : '—'}
            </DataTableCell>
            <DataTableCell>{r.hours} h</DataTableCell>
            <DataTableCell>{formatCurrency(r.daily_advance ?? 0)}</DataTableCell>
            <DataTableCell className="max-w-[200px] truncate">{r.note || '—'}</DataTableCell>
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

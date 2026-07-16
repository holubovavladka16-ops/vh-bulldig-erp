import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { AttendanceFormModal } from '@/components/attendance/AttendanceFormModal'
import { useAuth } from '@/context/AuthContext'
import { upsertAttendanceRecord, deleteAttendanceRecord } from '@/lib/attendance/api'
import { fetchAllAttendance, type AttendanceListRecord } from '@/lib/workers/module5'
import { fetchActiveJobOrders } from '@/lib/orders/api'
import { supabase } from '@/lib/supabase'
import { attendanceSourceLabel, canDeleteAttendanceRecord } from '@/constants/attendance'
import type { AttendanceUpsertInput } from '@/types/workers'
import { formatCurrency, formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'

interface AttendanceTabProps {
  workerId: string
  workerLabel: string
  isAdmin?: boolean
}

export function AttendanceTab({ workerId, workerLabel, isAdmin = false }: AttendanceTabProps) {
  const { user } = useAuth()
  const [records, setRecords] = useState<AttendanceListRecord[]>([])
  const [orders, setOrders] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AttendanceListRecord | null>(null)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRecords(await fetchAllAttendance({ workerId, sortBy: 'date', sortDir: 'desc' }))
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

  useEffect(() => {
    const channel = supabase
      .channel(`worker-attendance-${workerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'worker_attendance_records', filter: `worker_id=eq.${workerId}` },
        () => load()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [workerId, load])

  function openCreate() {
    setEditing(null)
    setActionError('')
    setModalOpen(true)
  }

  function openEdit(record: AttendanceListRecord) {
    setEditing(record)
    setActionError('')
    setModalOpen(true)
  }

  async function handleSave(data: AttendanceUpsertInput, id?: string | null) {
    if (!user) throw new Error('Nejste přihlášeni')
    await upsertAttendanceRecord({ ...data, worker_id: workerId }, user.id, id)
    await load()
  }

  async function handleDelete(record: AttendanceListRecord) {
    if (!user) return
    if (!window.confirm(`Smazat docházku ${formatDate(record.attendance_date)}?`)) return
    setActionError('')
    try {
      await deleteAttendanceRecord(record.id, user.id)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Smazání se nezdařilo')
    }
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
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nový zápis
          </Button>
        </div>
      )}

      {actionError && <p className="mb-3 text-sm text-red-400">{actionError}</p>}

      <DataTable
        columns={[
          { key: 'date', label: 'Datum' },
          { key: 'order', label: 'Zakázka' },
          { key: 'time', label: 'Prac. doba' },
          { key: 'hours', label: 'Hodiny' },
          { key: 'earnings', label: 'Výdělek' },
          { key: 'advance', label: 'Záloha' },
          { key: 'note', label: 'Poznámka' },
          { key: 'source', label: 'Zdroj' },
          ...(isAdmin ? [{ key: 'actions', label: '' }] : []),
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
            <DataTableCell>{r.earnings != null ? formatCurrency(r.earnings) : '—'}</DataTableCell>
            <DataTableCell>{formatCurrency(r.daily_advance ?? 0)}</DataTableCell>
            <DataTableCell className="max-w-[200px] truncate">{r.note || '—'}</DataTableCell>
            <DataTableCell>{attendanceSourceLabel(r.form_id, r.form_signature)}</DataTableCell>
            {isAdmin && (
              <DataTableCell>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(r)} aria-label="Upravit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(r)}
                    disabled={!canDeleteAttendanceRecord(r.form_id, r.form_signature)}
                    aria-label="Smazat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </DataTableCell>
            )}
          </DataTableRow>
        ))}
      </DataTable>

      {isAdmin && (
        <AttendanceFormModal
          open={modalOpen}
          initial={editing}
          workers={[{ id: workerId, label: workerLabel }]}
          orders={orders}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSave}
        />
      )}
    </div>
  )
}

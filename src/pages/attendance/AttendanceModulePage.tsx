import { useCallback, useEffect, useState } from 'react'
import { FileSpreadsheet, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { ModuleFilters } from '@/components/module5/ModuleFilters'
import { AttendanceFormModal } from '@/components/attendance/AttendanceFormModal'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { upsertAttendanceRecord, deleteAttendanceRecord } from '@/lib/attendance/api'
import { exportAttendanceExcel, exportAttendancePdf } from '@/lib/attendance/export'
import { fetchAllAttendance, fetchDistinctOrders, type AttendanceListRecord, type ModuleListFilters } from '@/lib/workers/module5'
import { fetchWorkers } from '@/lib/workers/api'
import { ATTENDANCE_STATUS_LABELS, attendanceSourceLabel } from '@/constants/attendance'
import { formatDate } from '@/constants/workers'
import { formatTimeForInput } from '@/lib/workers/attendance'
import type { AttendanceUpsertInput } from '@/types/workers'

export function AttendanceModulePage() {
  const { user } = useAuth()
  const { settings: company } = useCompanySettings()
  const [records, setRecords] = useState<AttendanceListRecord[]>([])
  const [workers, setWorkers] = useState<{ id: string; label: string }[]>([])
  const [orders, setOrders] = useState<{ id: string; label: string }[]>([])
  const [filters, setFilters] = useState<ModuleListFilters>({ sortBy: 'date', sortDir: 'desc' })
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AttendanceListRecord | null>(null)
  const [actionError, setActionError] = useState('')

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
    await upsertAttendanceRecord(data, user.id, id)
    await load()
  }

  async function handleDelete(record: AttendanceListRecord) {
    if (!user) return
    if (!window.confirm(`Smazat docházku ${formatDate(record.attendance_date)} – ${record.worker_last_name}?`)) return
    setActionError('')
    try {
      await deleteAttendanceRecord(record.id, user.id)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Smazání se nezdařilo')
    }
  }

  return (
    <AppLayout>
      <PageHeader
        title="Docházka zaměstnanců"
        description="Ruční zápisy administrátora i automatické záznamy z formulářů zaměstnanců. Propojeno s kartou zaměstnance, výkazy, zakázkami a výplatními páskami."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Nový zápis
            </Button>
            <Button variant="secondary" onClick={() => exportAttendancePdf(records, company)} disabled={records.length === 0} className="w-full sm:w-auto">
              <Printer className="h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="secondary" onClick={() => exportAttendanceExcel(records)} disabled={records.length === 0} className="w-full sm:w-auto">
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        }
      />

      <ModuleFilters
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        workers={workers}
        orders={orders}
        showAttendanceStatus
      />

      {actionError && <p className="mb-4 text-sm text-red-400">{actionError}</p>}

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
            { key: 'status', label: 'Stav' },
            { key: 'start', label: 'Začátek' },
            { key: 'end', label: 'Konec' },
            { key: 'break', label: 'Přestávka' },
            { key: 'hours', label: 'Hodiny' },
            { key: 'source', label: 'Zdroj' },
            { key: 'actions', label: '' },
          ]}
          isEmpty={records.length === 0}
          emptyMessage="Žádné záznamy docházky. Vytvořte první ruční zápis tlačítkem „Nový zápis“."
        >
          {records.map((r) => (
            <DataTableRow key={r.id}>
              <DataTableCell>{formatDate(r.attendance_date)}</DataTableCell>
              <DataTableCell>{r.worker_last_name} {r.worker_first_name}</DataTableCell>
              <DataTableCell>{r.order_name || '—'}</DataTableCell>
              <DataTableCell>{ATTENDANCE_STATUS_LABELS[r.attendance_status ?? 'pritomen']}</DataTableCell>
              <DataTableCell>{r.work_start ? formatTimeForInput(r.work_start) : '—'}</DataTableCell>
              <DataTableCell>{r.work_end ? formatTimeForInput(r.work_end) : '—'}</DataTableCell>
              <DataTableCell>{r.break_minutes ? `${r.break_minutes} min` : '—'}</DataTableCell>
              <DataTableCell>{r.hours} h</DataTableCell>
              <DataTableCell>{attendanceSourceLabel(r.form_id)}</DataTableCell>
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
                    disabled={Boolean(r.form_id)}
                    aria-label="Smazat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      <AttendanceFormModal
        open={modalOpen}
        initial={editing}
        workers={workers}
        orders={orders}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
      />
    </AppLayout>
  )
}

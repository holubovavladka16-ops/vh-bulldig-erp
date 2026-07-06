import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { ATTENDANCE_STATUS_OPTIONS } from '@/constants/attendance'
import { calcAttendanceHours } from '@/lib/attendance/api'
import { toDateInputValue } from '@/lib/dates'
import { formatTimeForInput } from '@/lib/workers/attendance'
import type { AttendanceListRecord } from '@/lib/workers/module5'
import type { AttendanceStatus, AttendanceUpsertInput } from '@/types/workers'

interface AttendanceFormModalProps {
  open: boolean
  initial?: AttendanceListRecord | null
  workers: { id: string; label: string }[]
  orders: { id: string; label: string }[]
  onClose: () => void
  onSubmit: (data: AttendanceUpsertInput, id?: string | null) => Promise<void>
}

const emptyForm: AttendanceUpsertInput = {
  worker_id: '',
  attendance_date: '',
  order_id: null,
  work_start: '',
  work_end: '',
  break_minutes: 0,
  attendance_status: 'pritomen',
  note: '',
}

export function AttendanceFormModal({
  open,
  initial,
  workers,
  orders,
  onClose,
  onSubmit,
}: AttendanceFormModalProps) {
  const [form, setForm] = useState<AttendanceUpsertInput>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isFormLinked = Boolean(initial?.form_id)
  const requiresTimes = form.attendance_status === 'pritomen'

  const calculatedHours = useMemo(
    () => calcAttendanceHours(form.attendance_status, form.work_start, form.work_end, form.break_minutes),
    [form.attendance_status, form.work_start, form.work_end, form.break_minutes]
  )

  useEffect(() => {
    if (!open) return

    if (initial) {
      setForm({
        worker_id: initial.worker_id,
        attendance_date: toDateInputValue(initial.attendance_date),
        order_id: initial.order_id,
        work_start: formatTimeForInput(initial.work_start),
        work_end: formatTimeForInput(initial.work_end),
        break_minutes: initial.break_minutes ?? 0,
        attendance_status: initial.attendance_status ?? 'pritomen',
        note: initial.note ?? '',
      })
    } else {
      setForm({
        ...emptyForm,
        attendance_date: new Date().toISOString().slice(0, 10),
        worker_id: workers[0]?.id ?? '',
      })
    }

    setError('')
  }, [open, initial, workers])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.worker_id || !form.attendance_date) {
      setError('Vyplňte datum a zaměstnance.')
      return
    }

    if (requiresTimes && (!form.work_start || !form.work_end)) {
      setError('U stavu Přítomen vyplňte začátek a konec práce.')
      return
    }

    if (requiresTimes && !form.order_id) {
      setError('U stavu Přítomen vyberte zakázku.')
      return
    }

    setLoading(true)
    try {
      await onSubmit(form, initial?.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení docházky se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  const workerOptions = [{ value: '', label: '— vyberte —' }, ...workers.map((w) => ({ value: w.id, label: w.label }))]
  const orderOptions = [{ value: '', label: '— bez zakázky —' }, ...orders.map((o) => ({ value: o.id, label: o.label }))]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="modal-sheet w-full max-w-2xl rounded-t-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-glass)] px-5 py-4">
          <h2 className="text-lg font-semibold text-theme-primary">
            {initial ? 'Upravit zápis docházky' : 'Nový zápis docházky'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-theme-muted hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {isFormLinked && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              Tento záznam pochází z formuláře zaměstnance. Úprava zde aktualizuje docházku; výdělek zůstává ve
              výkazu z formuláře.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Datum *"
              type="date"
              value={form.attendance_date}
              onChange={(e) => setForm({ ...form, attendance_date: e.target.value })}
              required
            />
            <Select
              label="Zaměstnanec *"
              options={workerOptions}
              value={form.worker_id}
              onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
            />
            <Select
              label="Zakázka"
              options={orderOptions}
              value={form.order_id ?? ''}
              onChange={(e) => setForm({ ...form, order_id: e.target.value || null })}
            />
            <Select
              label="Stav *"
              options={ATTENDANCE_STATUS_OPTIONS}
              value={form.attendance_status}
              onChange={(e) => setForm({ ...form, attendance_status: e.target.value as AttendanceStatus })}
            />
            <Input
              label="Začátek práce"
              type="time"
              value={form.work_start}
              disabled={!requiresTimes}
              onChange={(e) => setForm({ ...form, work_start: e.target.value })}
            />
            <Input
              label="Konec práce"
              type="time"
              value={form.work_end}
              disabled={!requiresTimes}
              onChange={(e) => setForm({ ...form, work_end: e.target.value })}
            />
            <Input
              label="Přestávka (min)"
              type="number"
              min={0}
              value={String(form.break_minutes)}
              disabled={!requiresTimes}
              onChange={(e) => setForm({ ...form, break_minutes: Number(e.target.value) || 0 })}
            />
            <Input label="Odpracované hodiny" value={`${calculatedHours} h`} disabled />
          </div>

          <Textarea
            label="Poznámka"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">
              Zrušit
            </Button>
            <Button type="submit" loading={loading} className="w-full sm:w-auto">
              Uložit zápis
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

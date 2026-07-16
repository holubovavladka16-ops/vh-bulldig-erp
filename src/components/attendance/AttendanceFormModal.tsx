import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { PortalPerformanceEditor } from '@/components/portal/PortalPerformanceEditor'
import { supabase } from '@/lib/supabase'
import { adminGetFormTaskItems, fetchPriceItems } from '@/lib/workers/api'
import { toDateInputValue, todayIsoDate } from '@/lib/dates'
import type { AttendanceListRecord } from '@/lib/workers/module5'
import type { AttendanceStatus, AttendanceUpsertInput, TaskLineInput, WorkerPriceItem, WorkType } from '@/types/workers'
import { formatCurrency } from '@/constants/workers'
import { ATTENDANCE_STATUS_OPTIONS } from '@/constants/attendance'
import { calculateFormEarnings, getHourlyRateItem, getTaskPriceItems, filterTaskLinesForSave } from '@/lib/workers/earnings'
import { calcWorkHours, formatTimeForInput } from '@/lib/workers/attendance'

interface AttendanceFormModalProps {
  open: boolean
  initial?: AttendanceListRecord | null
  workers: { id: string; label: string }[]
  orders: { id: string; label: string }[]
  onClose: () => void
  onSubmit: (data: AttendanceUpsertInput, id?: string | null) => Promise<void>
}

const emptyForm = {
  worker_id: '',
  attendance_date: '',
  order_id: '',
  work_start: '',
  work_end: '',
  break_minutes: 0,
  daily_advance: 0,
  note: '',
  attendance_status: 'pritomen' as AttendanceStatus,
}

export function AttendanceFormModal({
  open,
  initial,
  workers,
  orders,
  onClose,
  onSubmit,
}: AttendanceFormModalProps) {
  const [form, setForm] = useState(emptyForm)
  const [priceItems, setPriceItems] = useState<WorkerPriceItem[]>([])
  const [taskLines, setTaskLines] = useState<TaskLineInput[]>([])
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [priceError, setPriceError] = useState('')

  function createDefaultTaskLine(priceItemId: string): TaskLineInput {
    return {
      price_item_id: priceItemId,
      quantity: 0,
      lineKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `line-${Date.now()}`,
    }
  }

  const performanceItems = useMemo(() => getTaskPriceItems(priceItems), [priceItems])
  const hourlyItem = useMemo(() => getHourlyRateItem(priceItems), [priceItems])

  const calculatedHours = useMemo(
    () => calcWorkHours(form.work_start, form.work_end, form.break_minutes),
    [form.work_start, form.work_end, form.break_minutes]
  )

  const workType: WorkType = useMemo(() => {
    const hasTasks = taskLines.some((line) => line.quantity > 0)
    if (calculatedHours > 0 && hasTasks) return 'kombinovana'
    if (calculatedHours > 0) return 'hodinova'
    return 'ukolova'
  }, [calculatedHours, taskLines])

  const estimatedEarnings = useMemo(
    () => calculateFormEarnings(workType, hourlyItem, calculatedHours, taskLines, priceItems),
    [workType, hourlyItem, calculatedHours, taskLines, priceItems]
  )

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    if (initial) {
      const advance = initial.daily_advance ?? 0
      setForm({
        worker_id: initial.worker_id,
        attendance_date: toDateInputValue(initial.attendance_date),
        order_id: initial.order_id ?? '',
        work_start: formatTimeForInput(initial.work_start),
        work_end: formatTimeForInput(initial.work_end),
        break_minutes: initial.break_minutes ?? 0,
        daily_advance: advance,
        note: initial.note ?? '',
        attendance_status: initial.attendance_status ?? 'pritomen',
      })

      if (initial.form_id) {
        if (advance === 0) {
          supabase
            .from('worker_daily_forms')
            .select('advance, work_start, work_end, break_minutes')
            .eq('id', initial.form_id)
            .maybeSingle()
            .then(({ data }) => {
              if (!data) return
              const row = data as { advance?: number; work_start?: string; work_end?: string; break_minutes?: number }
              setForm((prev) => ({
                ...prev,
                daily_advance: row.advance ? Number(row.advance) : prev.daily_advance,
                work_start: prev.work_start || formatTimeForInput(row.work_start),
                work_end: prev.work_end || formatTimeForInput(row.work_end),
                break_minutes: prev.break_minutes || Number(row.break_minutes ?? 0),
              }))
            })
        }
      }
    } else {
      setForm({
        ...emptyForm,
        attendance_date: todayIsoDate(),
        worker_id: workers[0]?.id ?? '',
      })
      setTaskLines([])
    }

    setError('')
  }, [open, initial, workers])

  useEffect(() => {
    if (!open || !form.worker_id) {
      setPriceItems([])
      setTaskLines([])
      return
    }

    let cancelled = false
    const workerId = form.worker_id
    const formId = initial?.form_id ?? null

    setLoadingPrices(true)
    setPriceError('')
    setPriceItems([])
    setTaskLines([])

    fetchPriceItems(workerId)
      .then(async (items) => {
        if (cancelled) return
        setPriceItems(items)
        const perfItems = getTaskPriceItems(items)

        if (perfItems.length === 0) {
          setTaskLines([])
          setPriceError('Zaměstnanec nemá aktivní položky v osobním ceníku. Doplňte ceník v kartě dělníka.')
          return
        }

        if (formId) {
          const saved = await adminGetFormTaskItems(formId)
          if (cancelled) return
          const lines = saved.map((line) => ({
            price_item_id: line.price_item_id,
            quantity: Number(line.quantity) || 0,
            lineKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `line-${line.price_item_id}`,
          }))
          setTaskLines(lines.length > 0 ? lines : [createDefaultTaskLine(perfItems[0].id)])
        } else {
          setTaskLines([createDefaultTaskLine(perfItems[0].id)])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPriceError(err instanceof Error ? err.message : 'Načtení ceníku se nezdařilo')
          setPriceItems([])
          setTaskLines([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPrices(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, form.worker_id, initial?.form_id])

  if (!open) return null

  function buildTaskItems(): TaskLineInput[] {
    // Docházkové hodiny (OD–DO) se NIKDY automaticky nepřidávají jako placený výkon.
    // Pokud má být hodinová práce zaplacena, admin ji musí explicitně přidat tlačítkem
    // "Přidat výkon" a zadat konkrétní počet hodin - přesně jako u jakéhokoli jiného výkonu.
    return filterTaskLinesForSave(taskLines, priceItems)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.worker_id || !form.attendance_date) {
      setError('Vyplňte datum a zaměstnance.')
      return
    }

    if (!form.order_id) {
      setError('Zakázka je povinná – vyberte konkrétní zakázku.')
      return
    }

    const isPresent = form.attendance_status === 'pritomen'
    const hasHours = calculatedHours > 0
    const hasPerformance = taskLines.some((line) => line.quantity > 0)
    if (isPresent && !hasHours && !hasPerformance) {
      setError('Zadejte pracovní dobu (začátek/konec) nebo alespoň jeden výkon z ceníku.')
      return
    }

    const payload: AttendanceUpsertInput = {
      worker_id: form.worker_id,
      attendance_date: form.attendance_date,
      order_id: form.order_id,
      work_start: form.work_start,
      work_end: form.work_end,
      break_minutes: form.break_minutes,
      daily_advance: form.daily_advance,
      note: form.note,
      task_items: buildTaskItems(),
      attendance_status: form.attendance_status,
    }

    setLoading(true)
    try {
      await onSubmit(payload, initial?.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení docházky se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  const workerOptions = [{ value: '', label: '— vyberte zaměstnance —' }, ...workers.map((w) => ({ value: w.id, label: w.label }))]
  const orderOptions = [{ value: '', label: '— vyberte zakázku (povinné) —' }, ...orders.map((o) => ({ value: o.id, label: o.label }))]

  const content = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="attendance-modal-title">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-lg glass-panel neon-border scrollbar-premium">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border-glass)] pb-4">
          <h2 id="attendance-modal-title" className="text-lg font-semibold text-theme-primary sm:text-xl">
            {initial ? 'Upravit zápis docházky' : 'Nový zápis docházky'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-theme-muted hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              required
            />
            <Select
              label="Zakázka *"
              options={orderOptions}
              value={form.order_id}
              onChange={(e) => setForm({ ...form, order_id: e.target.value })}
              required
            />
            <Input
              label="Denní záloha (Kč)"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.daily_advance === 0 ? '' : String(form.daily_advance)}
              onChange={(e) => setForm({ ...form, daily_advance: parseFloat(e.target.value.replace(',', '.')) || 0 })}
            />
            <Select
              label="Stav docházky *"
              options={ATTENDANCE_STATUS_OPTIONS}
              value={form.attendance_status}
              onChange={(e) => setForm({ ...form, attendance_status: e.target.value as AttendanceStatus })}
              required
            />
          </div>

          <Card>
            <h3 className="mb-3 text-base font-semibold text-theme-primary">Pracovní doba</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Začátek práce"
                type="time"
                value={form.work_start}
                onChange={(e) => setForm({ ...form, work_start: e.target.value })}
              />
              <Input
                label="Konec práce"
                type="time"
                value={form.work_end}
                onChange={(e) => setForm({ ...form, work_end: e.target.value })}
              />
              <Input
                label="Přestávka (min)"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.break_minutes === 0 ? '' : String(form.break_minutes)}
                onChange={(e) => setForm({ ...form, break_minutes: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <p className="mt-3 text-sm">
              <span className="text-theme-muted">Odpracované hodiny (evidence docházky): </span>
              <span className="font-semibold text-accent">{calculatedHours} h</span>
            </p>
            <p className="mt-1 text-xs text-theme-muted">
              Tyto hodiny slouží pouze jako evidence přítomnosti a nejsou automaticky placeny. Pro
              placenou hodinovou práci přidejte níže výkon „Hodinová práce" s konkrétním počtem hodin.
            </p>
          </Card>

          <Card>
            {loadingPrices ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
              </div>
            ) : performanceItems.length === 0 ? (
              <p className="text-sm text-red-400">{priceError || 'Ceník není nastaven. Nejdříve doplňte ceník v kartě dělníka.'}</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-theme-muted">
                  Výkony podle osobního ceníku zaměstnance – metry, průrazy, m² a další položky. Můžete přidat více
                  činností za jeden den.
                </p>
                <PortalPerformanceEditor priceItems={priceItems} lines={taskLines} onChange={setTaskLines} />
              </>
            )}
          </Card>

          <div className="rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3 text-sm">
            <span className="text-theme-muted">Vypočtená mzda za den: </span>
            <span className="text-lg font-semibold text-accent">{formatCurrency(estimatedEarnings)}</span>
          </div>

          <Textarea
            label="Poznámka"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              Zrušit
            </Button>
            <Button type="submit" loading={loading}>
              Uložit zápis
            </Button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

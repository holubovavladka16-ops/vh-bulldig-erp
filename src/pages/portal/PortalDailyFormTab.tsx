import { useEffect, useState, type FormEvent } from 'react'
import { HardHat, Send, Save, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PortalWorkerContext } from '@/components/portal/PortalWorkerContext'
import { PortalPerformanceEditor } from '@/components/portal/PortalPerformanceEditor'
import { PortalFormTotals } from '@/components/portal/PortalFormTotals'
import { SignaturePad } from '@/components/portal/SignaturePad'
import { GpsCapture } from '@/components/portal/GpsCapture'
import { Select } from '@/components/ui/Select'
import {
  portalGetWorker,
  portalGetPriceItems,
  portalGetForms,
  portalGetDailyAdvances,
  portalSaveForm,
  portalSubmitForm,
  portalGetFormTaskItems,
  uploadFormPhoto,
  type PortalFormInput,
} from '@/lib/workers/api'
import { getTaskPriceItems, hasValidPerformances, filterTaskLinesForSave } from '@/lib/workers/earnings'
import { portalGetActiveOrders } from '@/lib/orders/api'
import type { ActiveJobOrderOption } from '@/types/orders'
import { calcWorkHours, formatTimeForInput } from '@/lib/workers/attendance'
import type {
  PortalWorker,
  WorkerPriceItem,
  WorkerDailyForm,
  PortalDailyAdvance,
  TaskLineInput,
} from '@/types/workers'
import { WORKER_FORM_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'
import { APP_INFO } from '@/constants/modules'

interface PortalDailyFormProps {
  token: string
}

interface PortalFormState {
  formDate: string
  orderId: string
  workStart: string
  workEnd: string
  breakMinutes: string
  advance: string
  material: string
  note: string
  taskLines: TaskLineInput[]
  gpsLat: number | null
  gpsLng: number | null
  gpsAccuracy: number | null
  signatureData: string | null
}

function createEmptyState(): PortalFormState {
  return {
    formDate: new Date().toISOString().split('T')[0],
    orderId: '',
    workStart: '',
    workEnd: '',
    breakMinutes: '0',
    advance: '0',
    material: '',
    note: '',
    taskLines: [],
    gpsLat: null,
    gpsLng: null,
    gpsAccuracy: null,
    signatureData: null,
  }
}

function stateFromForm(
  form: WorkerDailyForm,
  taskLines: TaskLineInput[]
): PortalFormState {
  return {
    formDate: form.form_date,
    orderId: form.order_id ?? '',
    workStart: formatTimeForInput(form.work_start),
    workEnd: formatTimeForInput(form.work_end),
    breakMinutes: String(form.break_minutes ?? 0),
    advance: String(form.advance),
    material: form.material ?? '',
    note: form.note ?? '',
    taskLines,
    gpsLat: form.gps_lat,
    gpsLng: form.gps_lng,
    gpsAccuracy: form.gps_accuracy,
    signatureData: form.signature_data,
  }
}

function createDefaultTaskLine(priceItemId: string): TaskLineInput {
  return {
    price_item_id: priceItemId,
    quantity: 0,
    lineKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `line-${Date.now()}`,
  }
}

function toSaveInput(formId: string | null, state: PortalFormState, priceItems: WorkerPriceItem[]): PortalFormInput {
  return {
    form_id: formId,
    form_date: state.formDate,
    order_id: state.orderId,
    work_start: state.workStart,
    work_end: state.workEnd,
    break_minutes: parseInt(state.breakMinutes, 10) || 0,
    advance: parseFloat(state.advance) || 0,
    material: state.material,
    note: state.note,
    gps_lat: state.gpsLat,
    gps_lng: state.gpsLng,
    gps_accuracy: state.gpsAccuracy,
    signature_data: state.signatureData,
    task_items: filterTaskLinesForSave(state.taskLines, priceItems),
  }
}

export function PortalDailyFormTab({ token }: PortalDailyFormProps) {
  const [worker, setWorker] = useState<PortalWorker | null>(null)
  const [activeOrders, setActiveOrders] = useState<ActiveJobOrderOption[]>([])
  const [priceItems, setPriceItems] = useState<WorkerPriceItem[]>([])
  const [advances, setAdvances] = useState<PortalDailyAdvance[]>([])
  const [forms, setForms] = useState<WorkerDailyForm[]>([])
  const [formId, setFormId] = useState<string | null>(null)
  const [state, setState] = useState<PortalFormState>(createEmptyState())
  const [photos, setPhotos] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const currentForm = forms.find((f) => f.id === formId)
  const isEditable =
    !formId ||
    currentForm?.status === 'koncept' ||
    currentForm?.status === 'k_oprave'

  const workHours = calcWorkHours(
    state.workStart,
    state.workEnd,
    parseInt(state.breakMinutes, 10) || 0
  )

  useEffect(() => {
    async function load() {
      const [w, orders, items, f, adv] = await Promise.all([
        portalGetWorker(token),
        portalGetActiveOrders(token),
        portalGetPriceItems(token),
        portalGetForms(token),
        portalGetDailyAdvances(token),
      ])
      setWorker(w)
      setActiveOrders(orders)
      setPriceItems(items)
      setForms(f)
      setAdvances(adv)
      if (w?.assigned_order_id && orders.some((o) => o.id === w.assigned_order_id)) {
        setState((prev) => ({ ...prev, orderId: w.assigned_order_id! }))
      } else if (orders[0]) {
        setState((prev) => ({ ...prev, orderId: prev.orderId || orders[0].id }))
      }
      const taskItems = getTaskPriceItems(items)
      if (taskItems[0]) {
        setState((prev) =>
          prev.taskLines.length > 0
            ? prev
            : { ...prev, taskLines: [createDefaultTaskLine(taskItems[0].id)] }
        )
      }
      setLoading(false)
    }
    load()
  }, [token])

  async function uploadPhotos(formId: string): Promise<string | null> {
    if (photos.length === 0) return null
    const failures: string[] = []
    for (const photo of photos) {
      try {
        await uploadFormPhoto(formId, photo, token)
      } catch (err) {
        failures.push(err instanceof Error ? err.message : 'Nahrání fotografie se nezdařilo')
      }
    }
    setPhotos([])
    return failures.length > 0 ? failures[0] : null
  }

  function updateState(patch: Partial<PortalFormState>) {
    setState((prev) => ({ ...prev, ...patch }))
  }

  function validatePerformances(): string | null {
    if (!hasValidPerformances(state.taskLines, priceItems)) {
      return 'Zadejte alespoň jeden výkon z ceníku s množstvím větším než 0.'
    }
    return null
  }

  async function handleSave(e?: FormEvent) {
    e?.preventDefault()
    if (!isEditable) return
    if (!state.orderId) {
      setError('Vyberte aktivní zakázku.')
      return
    }
    const performanceError = validatePerformances()
    if (performanceError) {
      setError(performanceError)
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const id = await portalSaveForm(token, toSaveInput(formId, state, priceItems))
      setFormId(id)
      const photoError = await uploadPhotos(id)
      setSuccess(photoError ? `Formulář uložen. ${photoError}` : 'Formulář uložen jako koncept')
      setForms(await portalGetForms(token))
      setAdvances(await portalGetDailyAdvances(token))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    if (!isEditable) return
    if (!state.signatureData) {
      setError('Před odesláním je nutný podpis zaměstnance.')
      return
    }
    if (!state.orderId) {
      setError('Vyberte aktivní zakázku.')
      return
    }
    const performanceError = validatePerformances()
    if (performanceError) {
      setError(performanceError)
      return
    }
    setSaving(true)
    setError('')
    try {
      const id = await portalSaveForm(token, toSaveInput(formId, state, priceItems))
      setFormId(id)
      const photoError = await uploadPhotos(id)
      await portalSubmitForm(token, id)
      setSuccess(
        photoError
          ? `Formulář odeslán. ${photoError}`
          : 'Formulář odeslán. Úpravy již nejsou možné.'
      )
      setForms(await portalGetForms(token))
      setAdvances(await portalGetDailyAdvances(token))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odeslání se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  async function loadForm(f: WorkerDailyForm) {
    if (f.status !== 'koncept' && f.status !== 'k_oprave') return
    const taskItems = await portalGetFormTaskItems(token, f.id)
    setFormId(f.id)
    setState(
      stateFromForm(
        f,
        taskItems.map((t) => ({
          price_item_id: t.price_item_id,
          quantity: t.quantity,
          lineKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `line-${t.price_item_id}`,
        }))
      )
    )
    setSuccess('')
    setError('')
  }

  function startNewForm() {
    setFormId(null)
    const defaultOrder =
      worker?.assigned_order_id && activeOrders.some((o) => o.id === worker.assigned_order_id)
        ? worker.assigned_order_id
        : activeOrders[0]?.id ?? ''
    const taskItems = getTaskPriceItems(priceItems)
    setState({
      ...createEmptyState(),
      orderId: defaultOrder,
      taskLines: taskItems[0] ? [createDefaultTaskLine(taskItems[0].id)] : [],
    })
    setPhotos([])
    setSuccess('')
    setError('')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  if (!worker) {
    return <Card className="text-center text-red-400">Neplatný nebo neaktivní odkaz.</Card>
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-8">
      <PortalWorkerContext worker={worker} priceItems={priceItems} advances={advances} />

      {!isEditable && currentForm && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <Lock className="h-4 w-4 shrink-0" />
          Formulář byl odeslán ({WORKER_FORM_STATUS_LABELS[currentForm.status]}) — úpravy nejsou možné.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-theme-primary">Zakázka</h2>
          {activeOrders.length === 0 ? (
            <p className="text-sm text-red-400">Nejsou k dispozici žádné aktivní zakázky.</p>
          ) : (
            <Select
              label="Vyberte aktivní zakázku"
              options={activeOrders.map((o) => ({
                value: o.id,
                label: `${o.name}${o.location ? ` — ${o.location}` : ''}`,
              }))}
              value={state.orderId}
              onChange={(e) => updateState({ orderId: e.target.value })}
              disabled={!isEditable}
              required
            />
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-theme-primary">Docházka</h2>
          <Input
            label="Datum"
            type="date"
            value={state.formDate}
            onChange={(e) => updateState({ formDate: e.target.value })}
            disabled={!isEditable}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Začátek práce"
              type="time"
              value={state.workStart}
              onChange={(e) => updateState({ workStart: e.target.value })}
              disabled={!isEditable}
            />
            <Input
              label="Konec práce"
              type="time"
              value={state.workEnd}
              onChange={(e) => updateState({ workEnd: e.target.value })}
              disabled={!isEditable}
            />
          </div>
          <Input
            label="Přestávka (minuty)"
            type="number"
            min="0"
            value={state.breakMinutes}
            onChange={(e) => updateState({ breakMinutes: e.target.value })}
            disabled={!isEditable}
          />
          {state.workStart && state.workEnd && (
            <p className="text-sm text-theme-secondary">
              Odpracované hodiny: <strong>{workHours} h</strong>
            </p>
          )}
        </Card>

        <Card>
          <PortalPerformanceEditor
            priceItems={priceItems}
            lines={state.taskLines}
            onChange={(taskLines) => updateState({ taskLines })}
            disabled={!isEditable}
          />
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-theme-primary">Další údaje</h2>
          <Input
            label="Denní záloha (Kč)"
            type="number"
            min="0"
            value={state.advance}
            onChange={(e) => updateState({ advance: e.target.value })}
            disabled={!isEditable}
          />
          <Textarea
            label="Materiál"
            value={state.material}
            onChange={(e) => updateState({ material: e.target.value })}
            disabled={!isEditable}
            placeholder="Použitý materiál…"
          />
          <Textarea
            label="Poznámka"
            value={state.note}
            onChange={(e) => updateState({ note: e.target.value })}
            disabled={!isEditable}
          />

          {isEditable && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-theme-secondary">Fotografie</label>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
                className="input-glass w-full rounded-xl px-3 py-2 text-sm"
              />
              {photos.length > 0 && (
                <p className="mt-1 text-xs text-theme-muted">{photos.length} soubor(ů) k nahrání</p>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-theme-secondary">GPS poloha</p>
            <GpsCapture
              lat={state.gpsLat}
              lng={state.gpsLng}
              accuracy={state.gpsAccuracy}
              disabled={!isEditable}
              onCapture={(lat, lng, accuracy) => updateState({ gpsLat: lat, gpsLng: lng, gpsAccuracy: accuracy })}
            />
          </div>

          <SignaturePad
            value={state.signatureData}
            onChange={(signatureData) => updateState({ signatureData })}
            disabled={!isEditable}
          />
        </Card>

        <PortalFormTotals
          taskLines={state.taskLines}
          priceItems={priceItems}
          advance={parseFloat(state.advance) || 0}
        />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            {success}
          </div>
        )}

        {isEditable && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" loading={saving} variant="secondary" className="flex-1">
              <Save className="h-4 w-4" />
              Uložit koncept
            </Button>
            <Button type="button" onClick={handleSubmit} loading={saving} className="flex-1">
              <Send className="h-4 w-4" />
              Odeslat formulář
            </Button>
          </div>
        )}

        {isEditable && formId && (
          <Button type="button" variant="ghost" onClick={startNewForm} className="w-full">
            Nový formulář
          </Button>
        )}
      </form>

      {forms.length > 0 && (
        <Card>
          <h3 className="mb-3 font-semibold text-theme-primary">Historie formulářů</h3>
          <div className="space-y-2">
            {forms.slice(0, 10).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => loadForm(f)}
                disabled={f.status !== 'koncept' && f.status !== 'k_oprave'}
                className="neon-border flex w-full items-center justify-between rounded-xl p-3 text-left text-sm transition-all hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div>
                  <span className="font-medium text-theme-primary">{formatDate(f.form_date)}</span>
                  <span className="mx-2 text-theme-muted">·</span>
                  <span className="text-accent">{formatCurrency(f.earnings)}</span>
                </div>
                <span className="text-theme-muted">{WORKER_FORM_STATUS_LABELS[f.status]}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export function PortalLayout({ children, workerName }: { children: React.ReactNode; workerName: string }) {
  return (
    <div className="app-background min-h-dvh">
      <header className="glass-panel neon-border sticky top-0 z-40 border-b !rounded-none px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl nav-item-active">
            <HardHat className="h-5 w-5 icon-neon" />
          </div>
          <div>
            <p className="font-bold text-theme-primary">{APP_INFO.shortName}</p>
            <p className="text-sm text-theme-muted">Denní výkaz – {workerName}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg p-4">{children}</main>
    </div>
  )
}

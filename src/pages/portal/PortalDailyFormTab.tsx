import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Lock } from 'lucide-react'
import { FieldModeAttendanceCard } from '@/components/portal/field/FieldModeAttendanceCard'
import { FieldModeGpsCard } from '@/components/portal/field/FieldModeGpsCard'
import { FieldModeHeader } from '@/components/portal/field/FieldModeHeader'
import { FieldModeMaterialCard } from '@/components/portal/field/FieldModeMaterialCard'
import { FieldModePhotoSection } from '@/components/portal/field/FieldModePhotoSection'
import { FieldModeSummaryCard } from '@/components/portal/field/FieldModeSummaryCard'
import { FieldModeVoiceButton } from '@/components/portal/field/FieldModeVoiceButton'
import { FieldModeWorkerCard } from '@/components/portal/field/FieldModeWorkerCard'
import { FieldModeCard } from '@/components/portal/field/FieldModeCard'
import { PortalPerformanceEditor } from '@/components/portal/PortalPerformanceEditor'
import { SignaturePad } from '@/components/portal/SignaturePad'
import { useCompanySettings } from '@/context/CompanySettingsContext'
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
import { buildPortalFormPdfBlob, getPortalFormPdfFilename } from '@/lib/workers/portalFormPdf'
import { downloadPdfBlob } from '@/lib/print/pdfShare'
import { calculatePerformanceEarnings, getTaskPriceItems, hasValidPerformances, filterTaskLinesForSave } from '@/lib/workers/earnings'
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
import { DEFAULT_COMPANY_SETTINGS } from '@/types'

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
  workDescription: string
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
    workDescription: '',
    taskLines: [],
    gpsLat: null,
    gpsLng: null,
    gpsAccuracy: null,
    signatureData: null,
  }
}

function stateFromForm(form: WorkerDailyForm, taskLines: TaskLineInput[]): PortalFormState {
  return {
    formDate: form.form_date,
    orderId: form.order_id ?? '',
    workStart: formatTimeForInput(form.work_start),
    workEnd: formatTimeForInput(form.work_end),
    breakMinutes: String(form.break_minutes ?? 0),
    advance: String(form.advance),
    material: form.material ?? '',
    note: form.note ?? '',
    workDescription: form.work_description ?? '',
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
    work_description: state.workDescription,
    gps_lat: state.gpsLat,
    gps_lng: state.gpsLng,
    gps_accuracy: state.gpsAccuracy,
    signature_data: state.signatureData,
    task_items: filterTaskLinesForSave(state.taskLines, priceItems),
  }
}

export function PortalDailyFormTab({ token }: PortalDailyFormProps) {
  const navigate = useNavigate()
  const { settings: companySettings } = useCompanySettings()
  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }
  const [worker, setWorker] = useState<PortalWorker | null>(null)
  const [activeOrders, setActiveOrders] = useState<ActiveJobOrderOption[]>([])
  const [priceItems, setPriceItems] = useState<WorkerPriceItem[]>([])
  const [, setAdvances] = useState<PortalDailyAdvance[]>([])
  const [forms, setForms] = useState<WorkerDailyForm[]>([])
  const [formId, setFormId] = useState<string | null>(null)
  const [state, setState] = useState<PortalFormState>(createEmptyState())
  const [photos, setPhotos] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false)
  const [redirectAfterSuccess, setRedirectAfterSuccess] = useState(false)
  const [gpsCapturedAt, setGpsCapturedAt] = useState<string | null>(null)
  const [gpsDeviceAvailable, setGpsDeviceAvailable] = useState(false)

  const currentForm = forms.find((f) => f.id === formId)
  const isEditable = !formId || currentForm?.status === 'koncept' || currentForm?.status === 'k_oprave'

  const workHours = calcWorkHours(state.workStart, state.workEnd, parseInt(state.breakMinutes, 10) || 0)
  const performancesTotal = calculatePerformanceEarnings(state.taskLines, priceItems)
  const advanceValue = parseFloat(state.advance) || 0
  const selectedOrder = activeOrders.find((o) => o.id === state.orderId)
  const presenceLabel = state.workEnd ? 'Ukončeno' : state.workStart ? 'Přítomen' : '—'
  const gpsActive = gpsDeviceAvailable && state.gpsLat != null && state.gpsLng != null

  useEffect(() => {
    setGpsDeviceAvailable(typeof navigator !== 'undefined' && Boolean(navigator.geolocation))
  }, [])

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
          prev.taskLines.length > 0 ? prev : { ...prev, taskLines: [createDefaultTaskLine(taskItems[0].id)] }
        )
      }
      setLoading(false)
    }
    void load()
  }, [token])

  useEffect(() => {
    if (!showSuccessOverlay || !redirectAfterSuccess) return
    const timer = window.setTimeout(() => {
      navigate(`/portal/${token}/muj-vykaz`)
    }, 2200)
    return () => window.clearTimeout(timer)
  }, [showSuccessOverlay, redirectAfterSuccess, navigate, token])

  async function persistForm(): Promise<string> {
    const id = await portalSaveForm(token, toSaveInput(formId, state, priceItems))
    setFormId(id)
    const photoError = await uploadPhotos(id)
    setForms(await portalGetForms(token))
    setAdvances(await portalGetDailyAdvances(token))
    return photoError ?? ''
  }

  function buildPdfInput() {
    if (!worker) throw new Error('Chybí údaje pracovníka.')
    return {
      worker,
      formDate: state.formDate,
      orderName: selectedOrder?.name ?? worker.assigned_order,
      workStart: state.workStart,
      workEnd: state.workEnd,
      breakMinutes: parseInt(state.breakMinutes, 10) || 0,
      workHours,
      advance: advanceValue,
      material: state.material,
      note: state.note,
      workDescription: state.workDescription,
      taskLines: state.taskLines,
      priceItems,
      earnings: performancesTotal,
      gpsLat: state.gpsLat,
      gpsLng: state.gpsLng,
      gpsAccuracy: state.gpsAccuracy,
      signatureData: state.signatureData,
    }
  }

  async function handleSavePdf() {
    if (!isEditable || !worker) return
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
      const photoError = await persistForm()
      const blob = await buildPortalFormPdfBlob(buildPdfInput(), company)
      downloadPdfBlob(blob, getPortalFormPdfFilename(worker, state.formDate))
      setSuccess(photoError ? `PDF vytvořeno. ${photoError}` : 'Výkaz uložen a PDF staženo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení nebo PDF se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  async function uploadPhotos(savedFormId: string): Promise<string | null> {
    if (photos.length === 0) return null
    const failures: string[] = []
    for (const photo of photos) {
      try {
        await uploadFormPhoto(savedFormId, photo, token)
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
    const hasPerformances = hasValidPerformances(state.taskLines, priceItems)
    const hasHours = workHours > 0
    if (!hasPerformances && !hasHours) {
      return 'Zadejte pracovní dobu (začátek/konec) nebo alespoň jeden výkon s množstvím větším než 0.'
    }
    return null
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
        photoError ? `Formulář odeslán. ${photoError}` : 'Formulář odeslán. Úpravy již nejsou možné.'
      )
      setForms(await portalGetForms(token))
      setAdvances(await portalGetDailyAdvances(token))
      setRedirectAfterSuccess(true)
      setShowSuccessOverlay(true)
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
    setPhotos([])
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--field-gold,#c9a227)]" />
      </div>
    )
  }

  if (!worker) {
    return <div className="field-mode-alert field-mode-alert--error">Neplatný nebo neaktivní odkaz.</div>
  }

  return (
    <>
      <FieldModeHeader gpsActive={gpsActive} />

      {!isEditable && currentForm && (
        <div className="field-mode-alert field-mode-alert--locked mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" />
          Formulář byl odeslán ({WORKER_FORM_STATUS_LABELS[currentForm.status]}) — úpravy nejsou možné.
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
        className="field-mode-grid pb-28"
      >
        <FieldModeWorkerCard
          worker={worker}
          orderId={state.orderId}
          orders={activeOrders}
          onOrderChange={(orderId) => updateState({ orderId })}
          disabled={!isEditable}
          presenceLabel={presenceLabel}
        />

        <FieldModeAttendanceCard
          formDate={state.formDate}
          workStart={state.workStart}
          workEnd={state.workEnd}
          breakMinutes={parseInt(state.breakMinutes, 10) || 0}
          workHours={workHours}
          disabled={!isEditable}
          onChange={(patch) =>
            updateState({
              ...(patch.formDate !== undefined && { formDate: patch.formDate }),
              ...(patch.workStart !== undefined && { workStart: patch.workStart }),
              ...(patch.workEnd !== undefined && { workEnd: patch.workEnd }),
              ...(patch.breakMinutes !== undefined && { breakMinutes: String(patch.breakMinutes) }),
            })
          }
        />

        <FieldModeCard title="Výkony" icon="🔧" className="field-mode-grid__full">
          <PortalPerformanceEditor
            priceItems={priceItems}
            lines={state.taskLines}
            onChange={(taskLines) => updateState({ taskLines })}
            disabled={!isEditable}
            workerMode
            fieldMode
          />
        </FieldModeCard>

        <FieldModeMaterialCard
          value={state.material}
          onChange={(material) => updateState({ material })}
          disabled={!isEditable}
        />

        <FieldModePhotoSection photos={photos} onChange={setPhotos} disabled={!isEditable} />

        <FieldModeGpsCard
          lat={state.gpsLat}
          lng={state.gpsLng}
          accuracy={state.gpsAccuracy}
          capturedAt={gpsCapturedAt}
          disabled={!isEditable}
          onCapture={(gpsLat, gpsLng, gpsAccuracy, capturedAt) => {
            updateState({ gpsLat, gpsLng, gpsAccuracy })
            setGpsCapturedAt(capturedAt)
          }}
        />

        <FieldModeCard title="Poznámka" icon="📝" className="field-mode-grid__full field-mode-note-full">
          <div className="field-mode-touch-input">
            <textarea
              id="field-note"
              value={[state.workDescription, state.note].filter(Boolean).join('\n\n')}
              disabled={!isEditable}
              placeholder="Popis práce, poznámky ze stavby…"
              onChange={(e) => {
                const text = e.target.value
                updateState({ workDescription: text, note: text })
              }}
            />
          </div>
          {isEditable && (
            <FieldModeVoiceButton
              disabled={!isEditable}
              onDictation={(text) => {
                const current = [state.workDescription, state.note].filter(Boolean).join('\n\n').trim()
                const next = current ? `${current} ${text}` : text
                updateState({ workDescription: next, note: next })
              }}
            />
          )}
        </FieldModeCard>

        <FieldModeSummaryCard
          workHours={workHours}
          earnings={performancesTotal}
          advance={advanceValue}
          disabled={!isEditable}
          onAdvanceChange={(value) => updateState({ advance: String(value) })}
        />

        <FieldModeCard title="Podpis" icon="✍️" className="field-mode-grid__full">
          <div className="field-mode-signature">
            <SignaturePad
              value={state.signatureData}
              onChange={(signatureData) => updateState({ signatureData })}
              disabled={!isEditable}
            />
          </div>
        </FieldModeCard>

        {error && <div className="field-mode-alert field-mode-alert--error field-mode-grid__full">{error}</div>}
        {success && !showSuccessOverlay && (
          <div className="field-mode-alert field-mode-alert--success field-mode-grid__full">{success}</div>
        )}

        {forms.length > 0 && (
          <FieldModeCard title="Historie formulářů" icon="📋" className="field-mode-grid__full">
            <div className="space-y-2">
              {forms.slice(0, 10).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => void loadForm(f)}
                  disabled={f.status !== 'koncept' && f.status !== 'k_oprave'}
                  className="field-mode-history-item"
                >
                  <div>
                    <span className="font-semibold text-theme-primary">{formatDate(f.form_date)}</span>
                    <span className="mx-2 text-theme-muted">·</span>
                    <span className="text-[var(--field-gold)]">{formatCurrency(f.earnings)}</span>
                  </div>
                  <span className="text-theme-muted">{WORKER_FORM_STATUS_LABELS[f.status]}</span>
                </button>
              ))}
            </div>
            {isEditable && formId && (
              <button type="button" className="field-mode-btn-secondary mt-3" onClick={startNewForm}>
                Nový formulář
              </button>
            )}
          </FieldModeCard>
        )}
      </form>

      {isEditable && (
        <div className="field-mode-save-bar">
          <div className="field-mode-save-bar__actions field-mode-save-bar__actions--dual">
            <button
              type="button"
              className="field-mode-btn-primary"
              disabled={saving}
              onClick={() => void handleSubmit()}
            >
              {saving ? 'Ukládám…' : '💾 Uložit výkaz'}
            </button>
            <button
              type="button"
              className="field-mode-btn-gold"
              disabled={saving}
              onClick={() => void handleSavePdf()}
            >
              {saving ? 'Ukládám…' : '📄 Uložit a vytvořit PDF'}
            </button>
          </div>
        </div>
      )}

      {showSuccessOverlay && (
        <div className="field-mode-success-overlay">
          <div className="field-mode-success-overlay__check">
            <Check className="h-10 w-10 text-white" strokeWidth={3} />
          </div>
          <p className="text-lg font-bold text-white">Výkaz uložen</p>
          <p className="text-sm text-theme-secondary">Přesměrování na seznam výkazů…</p>
        </div>
      )}
    </>
  )
}

export function PortalLayout({ children }: { children: ReactNode; workerName?: string }) {
  return (
    <div className="field-mode">
      <div className="field-mode__inner">
        <main className="field-mode-main">{children}</main>
      </div>
    </div>
  )
}

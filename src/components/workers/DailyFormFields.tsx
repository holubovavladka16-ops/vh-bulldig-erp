import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { AiPolishTextButton } from '@/components/ai/AiPolishTextButton'
import { WorkTypeSelector } from '@/components/workers/WorkTypeSelector'
import { TaskLinesEditor } from '@/components/workers/TaskLinesEditor'
import type { WorkerPriceItem, WorkType, TaskLineInput } from '@/types/workers'
import { calculateFormEarnings, getHourlyRateItem } from '@/lib/workers/earnings'
import { calcWorkHours, formatTimeForInput } from '@/lib/workers/attendance'
import { formatCurrency } from '@/constants/workers'

export interface DailyFormState {
  formDate: string
  orderId: string | null
  orderName: string
  workType: WorkType
  workDescription: string
  workStart: string
  workEnd: string
  breakMinutes: string
  hours: string
  advance: string
  material: string
  note: string
  taskLines: TaskLineInput[]
  gpsLat: number | null
  gpsLng: number | null
  gpsAccuracy: number | null
  signatureData: string | null
}

interface DailyFormFieldsProps {
  state: DailyFormState
  priceItems: WorkerPriceItem[]
  orderOptions?: { value: string; label: string }[]
  onChange: (patch: Partial<DailyFormState>) => void
  disabled?: boolean
  showEarnings?: boolean
  isAdmin?: boolean
  portalToken?: string
  onAiError?: (message: string) => void
}

export function DailyFormFields({
  state,
  priceItems,
  orderOptions = [],
  onChange,
  disabled,
  showEarnings = true,
  isAdmin = false,
  portalToken,
  onAiError,
}: DailyFormFieldsProps) {
  const hourlyItem = getHourlyRateItem(priceItems)
  const previewEarnings = calculateFormEarnings(
    state.workType,
    hourlyItem,
    parseFloat(state.hours) || calcWorkHours(state.workStart, state.workEnd, parseInt(state.breakMinutes, 10) || 0),
    state.taskLines,
    priceItems
  )

  const showHours =
    state.workType === 'hodinova' ||
    state.workType === 'ukolova' ||
    state.workType === 'kombinovana'

  const showWorkDescription = state.workType === 'hodinova' || state.workType === 'kombinovana'
  const showTaskLines = state.workType === 'ukolova' || state.workType === 'kombinovana'

  const computedHours = calcWorkHours(
    state.workStart,
    state.workEnd,
    parseInt(state.breakMinutes, 10) || 0
  )

  return (
    <div className="space-y-5">
      {isAdmin && (
        <WorkTypeSelector
          value={state.workType}
          onChange={(workType) => onChange({ workType })}
          disabled={disabled}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Datum"
          type="date"
          value={state.formDate}
          onChange={(e) => onChange({ formDate: e.target.value })}
          disabled={disabled}
          required
        />
        {isAdmin && orderOptions.length > 0 ? (
          <Select
            label="Zakázka"
            options={[{ value: '', label: '— vyberte —' }, ...orderOptions]}
            value={state.orderId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null
              const label = orderOptions.find((o) => o.value === id)?.label ?? ''
              onChange({ orderId: id, orderName: label })
            }}
            disabled={disabled}
            required
          />
        ) : isAdmin ? (
          <Input label="Zakázka" value={state.orderName} disabled readOnly />
        ) : (
          <Input label="Zakázka" value={state.orderName} disabled readOnly />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Začátek práce"
          type="time"
          value={state.workStart}
          onChange={(e) => onChange({ workStart: e.target.value, hours: String(calcWorkHours(e.target.value, state.workEnd, parseInt(state.breakMinutes, 10) || 0)) })}
          disabled={disabled}
        />
        <Input
          label="Konec práce"
          type="time"
          value={state.workEnd}
          onChange={(e) => onChange({ workEnd: e.target.value, hours: String(calcWorkHours(state.workStart, e.target.value, parseInt(state.breakMinutes, 10) || 0)) })}
          disabled={disabled}
        />
        <Input
          label="Přestávka (min)"
          type="number"
          min="0"
          value={state.breakMinutes}
          onChange={(e) => onChange({ breakMinutes: e.target.value, hours: String(calcWorkHours(state.workStart, state.workEnd, parseInt(e.target.value, 10) || 0)) })}
          disabled={disabled}
        />
      </div>

      {state.workStart && state.workEnd && (
        <p className="text-sm text-theme-secondary">Odpracované hodiny: {computedHours} h</p>
      )}

      {showHours && isAdmin && (
        <Input
          label={
            state.workType === 'ukolova'
              ? 'Odpracované hodiny (evidence docházky)'
              : 'Odpracované hodiny'
          }
          type="number"
          min="0"
          step="0.5"
          value={state.hours}
          onChange={(e) => onChange({ hours: e.target.value })}
          disabled={disabled}
        />
      )}

      {showWorkDescription && (
        <div className="space-y-3">
          <Textarea
            label="Popis práce"
            value={state.workDescription}
            onChange={(e) => onChange({ workDescription: e.target.value })}
            disabled={disabled}
            placeholder="Popište vykonanou práci…"
          />
          {!disabled && (
            <AiPolishTextButton
              sourceText={state.workDescription}
              context="daily_form"
              portalToken={portalToken}
              onPolished={(text) => onChange({ workDescription: text })}
              onError={onAiError}
            />
          )}
        </div>
      )}

      {showTaskLines && (
        <TaskLinesEditor
          priceItems={priceItems}
          lines={state.taskLines}
          onChange={(taskLines) => onChange({ taskLines })}
          disabled={disabled}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Záloha (Kč)"
          type="number"
          min="0"
          value={state.advance}
          onChange={(e) => onChange({ advance: e.target.value })}
          disabled={disabled}
        />
      </div>

      <Textarea
        label="Materiál"
        value={state.material}
        onChange={(e) => onChange({ material: e.target.value })}
        disabled={disabled}
      />

      <Textarea
        label="Poznámka"
        value={state.note}
        onChange={(e) => onChange({ note: e.target.value })}
        disabled={disabled}
      />

      {showEarnings && (
        <div className="glass-panel neon-border rounded-xl p-4">
          <p className="text-sm text-theme-secondary">Odhadovaný výdělek</p>
          <p className="text-2xl font-bold text-accent">{formatCurrency(previewEarnings)}</p>
        </div>
      )}
    </div>
  )
}

export function createEmptyFormState(): DailyFormState {
  return {
    formDate: new Date().toISOString().split('T')[0],
    orderId: null,
    orderName: '',
    workType: 'ukolova',
    workDescription: '',
    workStart: '',
    workEnd: '',
    breakMinutes: '0',
    hours: '0',
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

export function formStateFromWorkerForm(
  form: import('@/types/workers').WorkerDailyForm,
  taskLines: TaskLineInput[]
): DailyFormState {
  return {
    formDate: form.form_date,
    orderId: form.order_id,
    orderName: form.order_name,
    workType: form.work_type ?? 'ukolova',
    workDescription: form.work_description ?? '',
    workStart: formatTimeForInput(form.work_start),
    workEnd: formatTimeForInput(form.work_end),
    breakMinutes: String(form.break_minutes ?? 0),
    hours: String(form.hours),
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

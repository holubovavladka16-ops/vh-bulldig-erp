import { FieldModeCard } from '@/components/portal/field/FieldModeCard'
import { FieldModeStepper } from '@/components/portal/field/FieldModeStepper'

interface FieldModeAttendanceCardProps {
  formDate: string
  workStart: string
  workEnd: string
  breakMinutes: number
  workHours: number
  disabled?: boolean
  onChange: (patch: {
    formDate?: string
    workStart?: string
    workEnd?: string
    breakMinutes?: number
  }) => void
}

function formatTimeDisplay(value: string): string {
  if (!value) return '—:—'
  return value.slice(0, 5)
}

export function FieldModeAttendanceCard({
  formDate,
  workStart,
  workEnd,
  breakMinutes,
  workHours,
  disabled,
  onChange,
}: FieldModeAttendanceCardProps) {
  return (
    <FieldModeCard title="Docházka" icon="⏱️">
      <div className="field-mode-touch-input mb-3">
        <label htmlFor="field-date">Datum výkazu</label>
        <input
          id="field-date"
          type="date"
          value={formDate}
          disabled={disabled}
          onChange={(e) => onChange({ formDate: e.target.value })}
        />
      </div>

      <div className="field-mode-time-tiles">
        <label className="field-mode-time-tile field-mode-time-tile--in">
          <span className="field-mode-time-tile__label">🟢 Příchod</span>
          <input
            type="time"
            value={workStart}
            disabled={disabled}
            onChange={(e) => onChange({ workStart: e.target.value })}
          />
          <span className="field-mode-time-tile__display">{formatTimeDisplay(workStart)}</span>
        </label>
        <label className="field-mode-time-tile field-mode-time-tile--out">
          <span className="field-mode-time-tile__label">🔴 Odchod</span>
          <input
            type="time"
            value={workEnd}
            disabled={disabled}
            onChange={(e) => onChange({ workEnd: e.target.value })}
          />
          <span className="field-mode-time-tile__display">{formatTimeDisplay(workEnd)}</span>
        </label>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-theme-secondary">Přestávka (min)</p>
        <FieldModeStepper
          value={breakMinutes}
          onChange={(value) => onChange({ breakMinutes: value })}
          disabled={disabled}
          step={5}
        />
      </div>

      <div className="field-mode-hours-banner mt-4">
        <span>Odpracované hodiny</span>
        <strong>{workHours} h</strong>
      </div>
    </FieldModeCard>
  )
}

interface FieldModeStepperProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  min?: number
  step?: number
  decimals?: number
}

export function FieldModeStepper({
  value,
  onChange,
  disabled,
  min = 0,
  step = 1,
  decimals = 0,
}: FieldModeStepperProps) {
  const display = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))

  function dec() {
    const next = Math.max(min, Number((value - step).toFixed(decimals)))
    onChange(next)
  }

  function inc() {
    onChange(Number((value + step).toFixed(decimals)))
  }

  return (
    <div className="field-mode-stepper">
      <button type="button" className="field-mode-stepper__btn" onClick={dec} disabled={disabled || value <= min} aria-label="Snížit">
        −
      </button>
      <span className="field-mode-stepper__value">{display}</span>
      <button type="button" className="field-mode-stepper__btn" onClick={inc} disabled={disabled} aria-label="Zvýšit">
        +
      </button>
    </div>
  )
}

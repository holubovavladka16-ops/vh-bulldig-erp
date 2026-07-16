import { useEffect, useId, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { Calendar } from 'lucide-react'
import {
  formatDateCz,
  maskCzechDateInput,
  parseFlexibleDateInput,
  toDateInputValue,
} from '@/lib/dates'

interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string
  /** Hodnota ve formátu YYYY-MM-DD (pro DB). */
  value: string
  onChange: (isoValue: string) => void
  error?: string
  hint?: string
}

export function DateInput({
  label,
  value,
  onChange,
  disabled,
  required,
  error,
  hint,
  className = '',
  min,
  max,
  id,
  ...props
}: DateInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const nativeRef = useRef<HTMLInputElement>(null)
  const [textValue, setTextValue] = useState(() => formatDateCz(value))
  const [localError, setLocalError] = useState<string | null>(null)

  const isoValue = toDateInputValue(value)
  const displayError = error ?? localError

  useEffect(() => {
    setTextValue(formatDateCz(value))
    setLocalError(null)
  }, [value])

  function commitIso(iso: string) {
    onChange(iso)
    setTextValue(iso ? formatDateCz(iso) : '')
    setLocalError(null)
  }

  function handleNativeChange(e: ChangeEvent<HTMLInputElement>) {
    commitIso(e.target.value)
  }

  function handleTextChange(e: ChangeEvent<HTMLInputElement>) {
    const masked = maskCzechDateInput(e.target.value)
    setTextValue(masked)
    setLocalError(null)

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(masked)) {
      const parsed = parseFlexibleDateInput(masked)
      if (parsed) commitIso(parsed)
    }
  }

  function handleTextBlur() {
    if (!textValue.trim()) {
      if (required) setLocalError('Datum je povinné')
      commitIso('')
      return
    }

    const parsed = parseFlexibleDateInput(textValue)
    if (parsed === null) {
      setLocalError('Neplatné datum. Použijte formát DD.MM.RRRR')
      return
    }
    commitIso(parsed)
  }

  function openPicker() {
    if (disabled) return
    const native = nativeRef.current
    if (!native) return
    if (typeof native.showPicker === 'function') {
      native.showPicker()
    } else {
      native.click()
    }
  }

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-theme-secondary">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="DD.MM.RRRR"
          value={textValue}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(displayError)}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          className={`input-glass w-full rounded-xl py-2.5 pl-3.5 pr-11 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
            displayError ? 'border-red-400/50' : ''
          }`}
          {...props}
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={openPicker}
          className="touch-target absolute bottom-1 right-1 rounded-lg p-2 text-theme-muted hover:text-theme-primary disabled:opacity-50"
          aria-label="Otevřít kalendář"
        >
          <Calendar className="h-4 w-4" />
        </button>

        <input
          ref={nativeRef}
          type="date"
          value={isoValue}
          min={typeof min === 'string' ? min : undefined}
          max={typeof max === 'string' ? max : undefined}
          disabled={disabled}
          onChange={handleNativeChange}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full cursor-pointer opacity-0"
          style={{ WebkitAppearance: 'none' }}
        />
      </div>

      {hint && !displayError && <p className="mt-1.5 text-xs text-theme-muted">{hint}</p>}
      {displayError && <p className="mt-1.5 text-sm text-red-400">{displayError}</p>}
    </div>
  )
}

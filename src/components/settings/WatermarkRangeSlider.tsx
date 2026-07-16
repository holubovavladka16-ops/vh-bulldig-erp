interface WatermarkRangeSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  formatValue?: (value: number) => string
  onChange: (value: number) => void
}

export function WatermarkRangeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  formatValue,
  onChange,
}: WatermarkRangeSliderProps) {
  const display = formatValue ? formatValue(value) : String(value)

  function handleChange(next: number) {
    onChange(Math.max(min, Math.min(max, next)))
  }

  return (
    <div className="watermark-slider-field">
      <span className="watermark-slider-field__label">
        {label}: {display}
      </span>
      <input
        type="range"
        className="watermark-range-input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => handleChange(Number(e.target.value))}
        onInput={(e) => handleChange(Number(e.currentTarget.value))}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />
    </div>
  )
}

interface DiaryChipSelectProps {
  label: string
  hint?: string
  options: readonly string[]
  selected: string[]
  onChange: (selected: string[]) => void
  extraLabel?: string
  extraValue?: string
  onExtraChange?: (value: string) => void
}

export function DiaryChipSelect({
  label,
  hint,
  options,
  selected,
  onChange,
  extraLabel,
  extraValue = '',
  onExtraChange,
}: DiaryChipSelectProps) {
  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-theme-secondary">{label}</p>
        {hint && <p className="text-xs text-theme-muted">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                  : 'border-[var(--border-glass)] bg-white/5 text-theme-secondary hover:bg-white/10'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
      {onExtraChange && (
        <input
          type="text"
          value={extraValue}
          onChange={(e) => onExtraChange(e.target.value)}
          placeholder={extraLabel ?? 'Doplnit ručně…'}
          className="input-glass w-full rounded-xl px-3 py-2 text-sm"
        />
      )}
    </div>
  )
}

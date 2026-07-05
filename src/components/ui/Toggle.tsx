interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl p-3 transition-colors hover:bg-white/5">
      <div>
        <p className="text-sm font-medium text-theme-primary">{label}</p>
        {description && <p className="mt-0.5 text-xs text-theme-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative h-6 w-11 shrink-0 rounded-full border transition-all duration-300
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked
            ? 'border-[var(--accent-primary)] bg-[color-mix(in_srgb,var(--accent-primary)_30%,transparent)]'
            : 'border-[var(--border-glass)] bg-[var(--surface-input)]'}
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md
            transition-transform duration-300
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </label>
  )
}

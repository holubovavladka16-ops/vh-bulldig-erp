import type { WorkType } from '@/types/workers'
import { WORK_TYPE_LABELS, WORK_TYPE_DESCRIPTIONS } from '@/constants/workers'

interface WorkTypeSelectorProps {
  value: WorkType
  onChange: (value: WorkType) => void
  disabled?: boolean
}

const WORK_TYPES: WorkType[] = ['hodinova', 'ukolova', 'kombinovana']

export function WorkTypeSelector({ value, onChange, disabled }: WorkTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-theme-secondary">Typ práce *</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {WORK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={`
              neon-border rounded-xl p-4 text-left transition-all duration-300
              disabled:cursor-not-allowed disabled:opacity-50
              ${value === type ? 'nav-item-active' : 'hover:bg-white/5 border-transparent'}
            `}
          >
            <p className={`text-sm font-semibold ${value === type ? 'text-accent' : 'text-theme-primary'}`}>
              {WORK_TYPE_LABELS[type]}
            </p>
            <p className="mt-1 text-xs text-theme-muted">{WORK_TYPE_DESCRIPTIONS[type]}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

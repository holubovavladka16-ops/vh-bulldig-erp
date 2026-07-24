import { MapPin, MousePointer2, Navigation } from 'lucide-react'
import type { MeasurementMode } from '@/types/excavations'
import { MEASUREMENT_MODE_LABELS } from '@/types/excavations'

interface ExcavationModeSelectorProps {
  selectedMode: MeasurementMode | null
  disabled?: boolean
  onSelectMode: (mode: MeasurementMode) => void
}

const MODE_ICONS: Record<MeasurementMode, typeof MousePointer2> = {
  manual: MousePointer2,
  gps_walk: Navigation,
  address_route: MapPin,
}

const MODE_DESCRIPTIONS: Record<MeasurementMode, string> = {
  manual: 'Klikněte body na mapě nebo kreslete čáru. Délka se počítá okamžitě.',
  gps_walk: 'Zaměřte Start, projděte se na místo a označte Konec podle GPS.',
  address_route: 'Zadejte adresu začátku a konce – aplikace spočítá vzdálenost.',
}

export function ExcavationModeSelector({
  selectedMode,
  disabled,
  onSelectMode,
}: ExcavationModeSelectorProps) {
  const modes: MeasurementMode[] = ['manual', 'gps_walk', 'address_route']

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-theme-primary">Způsob měření trasy</h3>
        <p className="mt-1 text-sm text-theme-muted">
          Vyberte jeden ze tří režimů měření. Všechny umožňují uložit výsledek k zakázce.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {modes.map((mode) => {
          const Icon = MODE_ICONS[mode]
          const isSelected = selectedMode === mode
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => onSelectMode(mode)}
              className={`rounded-xl border p-3 text-left transition ${
                isSelected
                  ? 'border-[var(--accent-primary)] bg-white/5'
                  : 'border-[var(--border-glass)] hover:bg-white/5'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${isSelected ? 'text-accent' : 'text-theme-muted'}`} />
                <span className="text-sm font-medium text-theme-primary">
                  {MEASUREMENT_MODE_LABELS[mode]}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-theme-muted">{MODE_DESCRIPTIONS[mode]}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

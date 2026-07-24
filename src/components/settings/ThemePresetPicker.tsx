import { Check } from 'lucide-react'
import { VISUAL_THEMES, type VisualThemeId } from '@/constants/visualThemes'

interface ThemePresetPickerProps {
  value: VisualThemeId
  onChange: (themeId: VisualThemeId) => void
}

export function ThemePresetPicker({ value, onChange }: ThemePresetPickerProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-theme-primary">Motiv aplikace</p>
        <p className="mt-0.5 text-xs text-theme-muted">
          Vyberte vizuální styl rozhraní. Změna se projeví okamžitě bez restartu.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {VISUAL_THEMES.map((theme) => {
          const selected = value === theme.id

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              aria-pressed={selected}
              className={[
                'group relative overflow-hidden rounded-xl border p-3 text-left transition-all',
                selected
                  ? 'border-[var(--accent-primary)] shadow-[0_0_20px_var(--accent-glow)]'
                  : 'border-[var(--border-glass)] hover:border-[color-mix(in_srgb,var(--accent-primary)_35%,var(--border-glass))]',
              ].join(' ')}
            >
              <div
                className="mb-3 h-16 overflow-hidden rounded-lg border border-[var(--border-glass)]"
                style={{ background: theme.preview.background }}
              >
                <div className="flex h-full items-end gap-2 p-2">
                  <div
                    className="h-8 flex-1 rounded-md opacity-90"
                    style={{
                      background: `linear-gradient(135deg, ${theme.preview.accent}, ${theme.preview.accentSecondary})`,
                    }}
                  />
                  <div
                    className="h-8 w-8 rounded-md border"
                    style={{
                      borderColor: theme.preview.accent,
                      background: 'rgba(255,255,255,0.08)',
                    }}
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-theme-primary">{theme.label}</p>
                  <p className="mt-0.5 text-xs text-theme-muted">{theme.description}</p>
                </div>
                {selected ? (
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

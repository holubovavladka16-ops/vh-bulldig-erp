import type { AppDesign } from '@/types'
import { APP_DESIGN_OPTIONS } from '@/constants/appDesign'
import { Button } from '@/components/ui/Button'
import { Check } from 'lucide-react'

interface DesignPreviewCardProps {
  design: AppDesign
  active: boolean
  onSelect: () => void
}

function DesignPreviewMockup({ design }: { design: AppDesign }) {
  if (design === 'design_6') {
    return (
      <div className="design-preview design-preview--cyber">
        <div className="design-preview__sidebar">
          <div className="design-preview__logo" />
          <div className="design-preview__nav design-preview__nav--active" />
          <div className="design-preview__nav" />
          <div className="design-preview__nav" />
        </div>
        <div className="design-preview__main">
          <div className="design-preview__header">
            <span className="design-preview__title design-preview__title--cyan" />
            <span className="design-preview__subtitle design-preview__subtitle--cyan" />
          </div>
          <div className="design-preview__hex-row">
            <div className="design-preview__hex design-preview__hex--cyan" />
            <div className="design-preview__hex design-preview__hex--gold" />
            <div className="design-preview__hex design-preview__hex--green" />
          </div>
          <div className="design-preview__grid">
            <div className="design-preview__card design-preview__card--cyan" />
            <div className="design-preview__card design-preview__card--cyan" />
          </div>
        </div>
      </div>
    )
  }

  if (design === 'design_5') {
    return (
      <div className="design-preview design-preview--executive">
        <div className="design-preview__sidebar">
          <div className="design-preview__logo" />
          <div className="design-preview__nav design-preview__nav--active" />
          <div className="design-preview__nav" />
          <div className="design-preview__nav" />
        </div>
        <div className="design-preview__main">
          <div className="design-preview__header">
            <span className="design-preview__title design-preview__title--gold" />
            <span className="design-preview__subtitle design-preview__subtitle--gold" />
          </div>
          <div className="design-preview__hex-row">
            <div className="design-preview__hex" />
            <div className="design-preview__hex" />
            <div className="design-preview__hex" />
          </div>
          <div className="design-preview__grid">
            <div className="design-preview__card design-preview__card--gold" />
            <div className="design-preview__card design-preview__card--gold" />
          </div>
        </div>
      </div>
    )
  }

  if (design === 'design_4') {
    return (
      <div className="design-preview design-preview--industrial">
        <div className="design-preview__sidebar">
          <div className="design-preview__logo" />
          <div className="design-preview__nav design-preview__nav--active" />
          <div className="design-preview__nav" />
          <div className="design-preview__nav" />
        </div>
        <div className="design-preview__main">
          <div className="design-preview__header">
            <span className="design-preview__title design-preview__title--copper" />
            <span className="design-preview__subtitle design-preview__subtitle--turquoise" />
          </div>
          <div className="design-preview__grid">
            <div className="design-preview__card design-preview__card--copper" />
            <div className="design-preview__card design-preview__card--copper" />
            <div className="design-preview__card design-preview__card--copper" />
            <div className="design-preview__card design-preview__card--copper" />
          </div>
        </div>
      </div>
    )
  }

  if (design === 'design_3') {
    return (
      <div className="design-preview design-preview--purpur">
        <div className="design-preview__sidebar">
          <div className="design-preview__logo" />
          <div className="design-preview__nav design-preview__nav--active" />
          <div className="design-preview__nav" />
          <div className="design-preview__nav" />
        </div>
        <div className="design-preview__main">
          <div className="design-preview__header">
            <span className="design-preview__title design-preview__title--gold" />
            <span className="design-preview__subtitle design-preview__subtitle--turquoise" />
          </div>
          <div className="design-preview__grid">
            <div className="design-preview__card design-preview__card--gold" />
            <div className="design-preview__card design-preview__card--gold" />
            <div className="design-preview__card design-preview__card--gold" />
            <div className="design-preview__card design-preview__card--gold" />
          </div>
        </div>
      </div>
    )
  }

  if (design === 'design_2') {
    return (
      <div className="design-preview design-preview--premium">
        <div className="design-preview__sidebar">
          <div className="design-preview__logo" />
          <div className="design-preview__nav design-preview__nav--active" />
          <div className="design-preview__nav" />
          <div className="design-preview__nav" />
        </div>
        <div className="design-preview__main">
          <div className="design-preview__header">
            <span className="design-preview__title design-preview__title--gold" />
            <span className="design-preview__subtitle design-preview__subtitle--turquoise" />
          </div>
          <div className="design-preview__grid">
            <div className="design-preview__card design-preview__card--gold" />
            <div className="design-preview__card design-preview__card--gold" />
            <div className="design-preview__card design-preview__card--gold" />
            <div className="design-preview__card design-preview__card--gold" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="design-preview design-preview--original">
      <div className="design-preview__sidebar">
        <div className="design-preview__logo design-preview__logo--cyan" />
        <div className="design-preview__nav design-preview__nav--active-cyan" />
        <div className="design-preview__nav" />
        <div className="design-preview__nav" />
      </div>
      <div className="design-preview__main">
        <div className="design-preview__header">
          <span className="design-preview__title" />
          <span className="design-preview__subtitle" />
        </div>
        <div className="design-preview__grid">
          <div className="design-preview__card" />
          <div className="design-preview__card" />
          <div className="design-preview__card" />
          <div className="design-preview__card" />
        </div>
      </div>
    </div>
  )
}

export function DesignPreviewCard({ design, active, onSelect }: DesignPreviewCardProps) {
  const option = APP_DESIGN_OPTIONS.find((item) => item.id === design)
  if (!option) return null

  return (
    <div
      className={`glass-panel neon-border rounded-2xl p-5 transition-all duration-300 ${
        active ? 'ring-2 ring-[var(--accent-primary)] glow-accent' : ''
      }`}
    >
      <div className="mb-4 overflow-hidden rounded-xl border border-[var(--border-glass)]">
        <DesignPreviewMockup design={design} />
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-theme-primary">{option.label}</h3>
          {active && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 px-2 py-0.5 text-xs font-medium text-accent">
              <Check className="h-3 w-3" />
              Aktivní
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-theme-secondary">{option.description}</p>
      </div>

      <Button
        variant={active ? 'secondary' : 'primary'}
        className="w-full"
        disabled={active}
        onClick={onSelect}
      >
        {active ? 'Aktuální design' : 'Použít na tomto zařízení'}
      </Button>
    </div>
  )
}

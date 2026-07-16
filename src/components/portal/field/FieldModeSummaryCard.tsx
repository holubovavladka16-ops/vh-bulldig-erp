import { FieldModeCard } from '@/components/portal/field/FieldModeCard'
import { FieldModeStepper } from '@/components/portal/field/FieldModeStepper'
import { formatCurrency } from '@/constants/workers'

interface FieldModeSummaryCardProps {
  workHours: number
  earnings: number
  advance: number
  disabled?: boolean
  onAdvanceChange: (value: number) => void
}

export function FieldModeSummaryCard({
  workHours,
  earnings,
  advance,
  disabled,
  onAdvanceChange,
}: FieldModeSummaryCardProps) {
  const net = Math.max(0, earnings - advance)

  return (
    <FieldModeCard title="Souhrn" icon="💰" className="field-mode-summary-card field-mode-grid__full">
      <div className="field-mode-summary">
        <div className="field-mode-summary__row">
          <span>Odpracováno</span>
          <strong>{workHours.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h</strong>
        </div>
        <div className="field-mode-summary__row">
          <span>Výdělek</span>
          <strong>{formatCurrency(earnings)}</strong>
        </div>
        <div className="field-mode-summary__row">
          <span>Záloha</span>
          <strong>{formatCurrency(advance)}</strong>
        </div>
        {!disabled && (
          <div className="py-2">
            <p className="mb-2 text-xs text-theme-muted">Upravit denní zálohu</p>
            <FieldModeStepper value={advance} onChange={onAdvanceChange} disabled={disabled} step={100} />
          </div>
        )}
        <div className="field-mode-summary__net">
          <span>K vyplacení</span>
          <strong>{formatCurrency(net)}</strong>
        </div>
        <p className="text-xs text-theme-muted">
          Odhad z výkonů minus záloha. Finální částku schvaluje administrátor.
        </p>
      </div>
    </FieldModeCard>
  )
}

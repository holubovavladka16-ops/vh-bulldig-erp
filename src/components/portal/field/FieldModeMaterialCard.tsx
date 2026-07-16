import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { FieldModeCard } from '@/components/portal/field/FieldModeCard'
import { FieldModeStepper } from '@/components/portal/field/FieldModeStepper'
import { formatCurrency } from '@/constants/workers'

export interface MaterialLine {
  id: string
  name: string
  qty: number
  unitPrice: number
}

const LINE_SEP = '\n'
const FIELD_SEP = '::'

function parseMaterial(value: string): MaterialLine[] {
  if (!value.trim()) return []
  return value.split(LINE_SEP).map((line, index) => {
    if (!line.includes(FIELD_SEP)) {
      return {
        id: `mat-${index}-${line.slice(0, 8)}`,
        name: line.trim(),
        qty: 1,
        unitPrice: 0,
      }
    }
    const [name = '', qty = '1', unitPrice = '0'] = line.split(FIELD_SEP)
    return {
      id: `mat-${index}-${name.slice(0, 8)}`,
      name: name.trim(),
      qty: parseFloat(qty) || 0,
      unitPrice: parseFloat(unitPrice) || 0,
    }
  })
}

function serializeMaterial(lines: MaterialLine[]): string {
  return lines
    .filter((line) => line.name.trim())
    .map((line) => `${line.name.trim()}${FIELD_SEP}${line.qty}${FIELD_SEP}${line.unitPrice}`)
    .join(LINE_SEP)
}

interface FieldModeMaterialCardProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function FieldModeMaterialCard({ value, onChange, disabled }: FieldModeMaterialCardProps) {
  const [lines, setLines] = useState<MaterialLine[]>(() => parseMaterial(value))

  useEffect(() => {
    setLines(parseMaterial(value))
  }, [value])

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
    [lines]
  )

  function commit(next: MaterialLine[]) {
    setLines(next)
    onChange(serializeMaterial(next))
  }

  function addLine() {
    commit([
      ...lines,
      {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mat-${Date.now()}`,
        name: '',
        qty: 1,
        unitPrice: 0,
      },
    ])
  }

  function updateLine(id: string, patch: Partial<MaterialLine>) {
    commit(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }

  function removeLine(id: string) {
    commit(lines.filter((line) => line.id !== id))
  }

  return (
    <FieldModeCard title="Materiál" icon="🧱">
      {lines.length === 0 ? (
        <p className="mb-3 text-sm text-theme-muted">Zatím žádný materiál.</p>
      ) : (
        <div className="space-y-3">
          {lines.map((line) => (
            <div key={line.id} className="field-mode-work-card">
              <div className="field-mode-touch-input mb-2">
                <label>Název materiálu</label>
                <input
                  type="text"
                  value={line.name}
                  disabled={disabled}
                  placeholder="Např. trubka PE 32"
                  onChange={(e) => updateLine(line.id, { name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-theme-secondary">Množství</p>
                  <FieldModeStepper
                    value={line.qty}
                    onChange={(qty) => updateLine(line.id, { qty })}
                    disabled={disabled}
                    step={1}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-theme-secondary">Cena / jednotka (Kč)</p>
                  <FieldModeStepper
                    value={line.unitPrice}
                    onChange={(unitPrice) => updateLine(line.id, { unitPrice })}
                    disabled={disabled}
                    step={10}
                  />
                </div>
              </div>
              <p className="mt-2 text-sm text-theme-secondary">
                Řádek: <strong className="text-theme-primary">{formatCurrency(line.qty * line.unitPrice)}</strong>
              </p>
              {!disabled && (
                <button
                  type="button"
                  className="mt-2 inline-flex min-h-[48px] items-center gap-2 text-sm font-semibold text-red-300"
                  onClick={() => removeLine(line.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Odebrat
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <button type="button" className="field-mode-btn-secondary mt-3" onClick={addLine}>
          <Plus className="h-4 w-4" />
          Přidat materiál
        </button>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-sm text-theme-secondary">Celkem materiál</span>
        <span className="text-lg font-bold text-[var(--field-gold)]">{formatCurrency(total)}</span>
      </div>
    </FieldModeCard>
  )
}

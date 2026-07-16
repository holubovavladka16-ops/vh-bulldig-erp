import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PriceItemPicker } from '@/components/workers/PriceItemPicker'
import { FieldModeStepper } from '@/components/portal/field/FieldModeStepper'
import type { WorkerPriceItem, TaskLineInput } from '@/types/workers'
import {
  getTaskPriceItems,
  calculateTaskLineEarnings,
  getQuantityLabel,
} from '@/lib/workers/earnings'
import { PRICE_UNIT_LABELS, formatCurrency } from '@/constants/workers'

interface PortalPerformanceEditorProps {
  priceItems: WorkerPriceItem[]
  lines: TaskLineInput[]
  onChange: (lines: TaskLineInput[]) => void
  disabled?: boolean
  workerMode?: boolean
  fieldMode?: boolean
}

function newLineKey(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createTaskLine(priceItemId: string): TaskLineInput {
  return { price_item_id: priceItemId, quantity: 0, lineKey: newLineKey() }
}

export function PortalPerformanceEditor({
  priceItems,
  lines,
  onChange,
  disabled,
  workerMode = false,
  fieldMode = false,
}: PortalPerformanceEditorProps) {
  const items = getTaskPriceItems(priceItems)

  function addLine() {
    const first = items[0]
    if (!first) return
    onChange([...lines, createTaskLine(first.id)])
  }

  function updateLine(index: number, patch: Partial<TaskLineInput>) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index))
  }

  if (fieldMode) {
    return (
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-theme-muted">
            V osobním ceníku nejsou aktivní položky pro výkony.
          </p>
        ) : lines.length === 0 ? (
          <p className="text-sm text-theme-muted">Přidejte vykázané práce.</p>
        ) : (
          lines.map((line, index) => {
            const item = items.find((p) => p.id === line.price_item_id) ?? items[0]
            const unitLabel = item ? getQuantityLabel(item.unit_type) : 'ks'
            const unitPrice = item?.price ?? 0
            const lineTotal = item ? calculateTaskLineEarnings(item, line.quantity) : 0

            return (
              <div key={line.lineKey ?? `${line.price_item_id}-${index}`} className="field-mode-work-card">
                <PriceItemPicker
                  label="Název práce"
                  items={items}
                  value={item?.id ?? line.price_item_id}
                  disabled={disabled}
                  showPrice={false}
                  onChange={(id) => updateLine(index, { price_item_id: id })}
                />
                <dl className="field-mode-work-card__meta">
                  <div>
                    <dt>Jednotka</dt>
                    <dd>{item ? PRICE_UNIT_LABELS[item.unit_type] : '—'}</dd>
                  </div>
                  <div>
                    <dt>Cena</dt>
                    <dd>{formatCurrency(unitPrice)}</dd>
                  </div>
                </dl>
                <p className="mb-2 text-sm font-medium text-theme-secondary">{unitLabel}</p>
                <FieldModeStepper
                  value={line.quantity}
                  onChange={(quantity) => updateLine(index, { quantity })}
                  disabled={disabled}
                  step={item?.unit_type === 'hodina' ? 0.5 : 1}
                  decimals={item?.unit_type === 'hodina' ? 1 : 0}
                />
                <p className="mt-2 text-sm text-theme-secondary">
                  Celkem: <strong className="text-[var(--field-gold)]">{formatCurrency(lineTotal)}</strong>
                </p>
                {!disabled && lines.length > 1 && (
                  <button
                    type="button"
                    className="mt-2 inline-flex min-h-[48px] items-center gap-2 text-sm font-semibold text-red-300"
                    onClick={() => removeLine(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Odebrat
                  </button>
                )}
              </div>
            )
          })
        )}

        {!disabled && items.length > 0 && (
          <button type="button" className="field-mode-btn-secondary" onClick={addLine}>
            + Přidat výkon
          </button>
        )}
      </div>
    )
  }

  // Legacy compact editor (admin / non-field)
  return (
    <LegacyPerformanceEditor
      lines={lines}
      disabled={disabled}
      workerMode={workerMode}
      items={items}
      addLine={addLine}
      updateLine={updateLine}
      removeLine={removeLine}
    />
  )
}

function LegacyPerformanceEditor({
  lines,
  disabled,
  workerMode,
  items,
  addLine,
  updateLine,
  removeLine,
}: {
  lines: TaskLineInput[]
  disabled?: boolean
  workerMode?: boolean
  items: WorkerPriceItem[]
  addLine: () => void
  updateLine: (index: number, patch: Partial<TaskLineInput>) => void
  removeLine: (index: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-theme-primary">Výkony</h3>
        {!disabled && items.length > 0 && (
          <button type="button" className="field-mode-btn-secondary !min-h-[40px] !w-auto px-3" onClick={addLine}>
            <Plus className="h-4 w-4" />
            Přidat výkon
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-theme-muted">V osobním ceníku nejsou aktivní položky pro výkony.</p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-theme-muted">Přidejte výkony z vašeho osobního ceníku.</p>
      ) : (
        <div className="space-y-3">
          {lines.map((line, index) => {
            const item = items.find((p) => p.id === line.price_item_id) ?? items[0]
            const unitLabel = item ? getQuantityLabel(item.unit_type) : 'množství'
            const unitPrice = item?.price ?? 0
            const lineTotal = item ? calculateTaskLineEarnings(item, line.quantity) : 0

            return (
              <div key={line.lineKey ?? `${line.price_item_id}-${index}`} className="neon-border space-y-3 rounded-xl p-3">
                <PriceItemPicker
                  label="Druh činnosti"
                  items={items}
                  value={item?.id ?? line.price_item_id}
                  disabled={disabled}
                  showPrice={!workerMode}
                  onChange={(id) => updateLine(index, { price_item_id: id })}
                />
                <LegacyQuantityInput
                  label={`Množství (${unitLabel})`}
                  quantity={line.quantity}
                  disabled={disabled}
                  onChange={(quantity) => updateLine(index, { quantity })}
                />
                {!workerMode && (
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <p className="text-theme-muted">Jednotková cena</p>
                      <p className="font-medium text-theme-primary">{formatCurrency(unitPrice)}</p>
                    </div>
                    <div>
                      <p className="text-theme-muted">Celková cena</p>
                      <p className="font-semibold text-accent">{formatCurrency(lineTotal)}</p>
                    </div>
                  </div>
                )}
                {!disabled && lines.length > 1 && (
                  <button type="button" className="inline-flex items-center gap-2 text-sm text-red-400" onClick={() => removeLine(index)}>
                    <Trash2 className="h-4 w-4" />
                    Odebrat
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LegacyQuantityInput({
  label,
  quantity,
  disabled,
  onChange,
}: {
  label: string
  quantity: number
  disabled?: boolean
  onChange: (quantity: number) => void
}) {
  const [text, setText] = useState(quantity > 0 ? String(quantity) : '')

  useEffect(() => {
    const next = quantity > 0 ? String(quantity) : ''
    setText((prev) => {
      const parsed = parseFloat(prev.replace(',', '.'))
      if (!Number.isNaN(parsed) && parsed === quantity) return prev
      return next
    })
  }, [quantity])

  return (
    <div className="field-mode-touch-input">
      <label>{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          const parsed = parseFloat(raw.replace(',', '.'))
          onChange(Number.isNaN(parsed) ? 0 : parsed)
        }}
      />
    </div>
  )
}

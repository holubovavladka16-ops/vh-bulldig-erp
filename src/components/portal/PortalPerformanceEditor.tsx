import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { WorkerPriceItem, TaskLineInput } from '@/types/workers'
import {
  getTaskPriceItems,
  calculateTaskLineEarnings,
  getQuantityLabel,
  parseQuantityInput,
} from '@/lib/workers/earnings'
import { PRICE_UNIT_LABELS, formatCurrency } from '@/constants/workers'

interface PortalPerformanceEditorProps {
  priceItems: WorkerPriceItem[]
  lines: TaskLineInput[]
  onChange: (lines: TaskLineInput[]) => void
  disabled?: boolean
}

function newLineKey(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createTaskLine(priceItemId: string): TaskLineInput {
  return { price_item_id: priceItemId, quantity: 0, lineKey: newLineKey() }
}

function QuantityInput({
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
      const parsed = parseQuantityInput(prev)
      if (parsed === quantity) return prev
      return next
    })
  }, [quantity])

  return (
    <Input
      label={label}
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      value={text}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        onChange(parseQuantityInput(raw))
      }}
      onBlur={() => {
        if (quantity > 0) setText(String(quantity))
        else setText('')
      }}
    />
  )
}

export function PortalPerformanceEditor({
  priceItems,
  lines,
  onChange,
  disabled,
}: PortalPerformanceEditorProps) {
  const items = getTaskPriceItems(priceItems)
  const options = items.map((p) => ({
    value: p.id,
    label: `${p.name} (${PRICE_UNIT_LABELS[p.unit_type]})`,
  }))

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-theme-primary">Výkony</h3>
        {!disabled && items.length > 0 && (
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" />
            Přidat výkon
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-theme-muted">
          V osobním ceníku nejsou aktivní položky pro výkony. Administrátor musí doplnit ceník v kartě
          zaměstnance.
        </p>
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
                <Select
                  label="Druh činnosti"
                  options={options}
                  value={item?.id ?? line.price_item_id}
                  disabled={disabled}
                  onChange={(e) => updateLine(index, { price_item_id: e.target.value })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <QuantityInput
                    label={`Množství (${unitLabel})`}
                    quantity={line.quantity}
                    disabled={disabled}
                    onChange={(quantity) => updateLine(index, { quantity })}
                  />
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-theme-secondary">Jednotka</p>
                    <p className="rounded-xl bg-white/5 px-3 py-2.5 text-sm text-theme-primary">
                      {item ? PRICE_UNIT_LABELS[item.unit_type] : '—'}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-theme-muted">Jednotková cena</p>
                    <p className="font-medium text-theme-primary">{formatCurrency(unitPrice)}</p>
                  </div>
                  <div>
                    <p className="text-theme-muted">Celková cena</p>
                    <p className="font-semibold text-accent">{formatCurrency(lineTotal)}</p>
                  </div>
                </div>
                {!disabled && lines.length > 1 && (
                  <Button type="button" variant="danger" size="sm" onClick={() => removeLine(index)}>
                    <Trash2 className="h-4 w-4" />
                    Odebrat
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

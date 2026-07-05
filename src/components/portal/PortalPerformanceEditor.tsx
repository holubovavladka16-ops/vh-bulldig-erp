import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { WorkerPriceItem, TaskLineInput } from '@/types/workers'
import { getTaskPriceItems, calculateTaskLineEarnings, getQuantityLabel } from '@/lib/workers/earnings'
import { PRICE_UNIT_LABELS, formatCurrency } from '@/constants/workers'

interface PortalPerformanceEditorProps {
  priceItems: WorkerPriceItem[]
  lines: TaskLineInput[]
  onChange: (lines: TaskLineInput[]) => void
  disabled?: boolean
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
    label: p.name,
  }))

  function addLine() {
    const first = items[0]
    if (!first) return
    onChange([...lines, { price_item_id: first.id, quantity: 0 }])
  }

  function updateLine(index: number, patch: Partial<TaskLineInput>) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-theme-primary">Výkony</h3>
        {!disabled && items.length > 0 && (
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" />
            Přidat výkon
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-theme-muted">V ceníku nejsou aktivní položky.</p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-theme-muted">Přidejte výkony z vašeho osobního ceníku.</p>
      ) : (
        <div className="space-y-3">
          {lines.map((line, index) => {
            const item = items.find((p) => p.id === line.price_item_id)
            const unitLabel = item ? getQuantityLabel(item.unit_type) : 'množství'
            const unitPrice = item?.price ?? 0
            const lineTotal = item ? calculateTaskLineEarnings(item, line.quantity) : 0

            return (
              <div key={index} className="neon-border space-y-3 rounded-xl p-3">
                <Select
                  label="Název práce"
                  options={options}
                  value={line.price_item_id}
                  disabled={disabled}
                  onChange={(e) => updateLine(index, { price_item_id: e.target.value })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label={`Množství (${unitLabel})`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={line.quantity === 0 ? '' : line.quantity}
                    disabled={disabled}
                    onChange={(e) =>
                      updateLine(index, { quantity: parseFloat(e.target.value.replace(',', '.')) || 0 })
                    }
                  />
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-theme-secondary">Jednotka</p>
                    <p className="rounded-xl bg-white/5 px-3 py-2.5 text-sm text-theme-primary">
                      {item ? PRICE_UNIT_LABELS[item.unit_type] : '—'}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="text-theme-muted">Cena za jednotku</p>
                    <p className="font-medium text-theme-primary">{formatCurrency(unitPrice)}</p>
                  </div>
                  <div>
                    <p className="text-theme-muted">Cena celkem</p>
                    <p className="font-semibold text-accent">{formatCurrency(lineTotal)}</p>
                  </div>
                </div>
                {!disabled && (
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

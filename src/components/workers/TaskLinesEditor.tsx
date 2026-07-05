import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { WorkerPriceItem, TaskLineInput } from '@/types/workers'
import { getTaskPriceItems, getQuantityLabel } from '@/lib/workers/earnings'
import { PRICE_UNIT_LABELS } from '@/constants/workers'

interface TaskLinesEditorProps {
  priceItems: WorkerPriceItem[]
  lines: TaskLineInput[]
  onChange: (lines: TaskLineInput[]) => void
  disabled?: boolean
}

export function TaskLinesEditor({ priceItems, lines, onChange, disabled }: TaskLinesEditorProps) {
  const taskItems = getTaskPriceItems(priceItems)
  const options = taskItems.map((p) => ({
    value: p.id,
    label: `${p.name} (${PRICE_UNIT_LABELS[p.unit_type]})`,
  }))

  function addLine() {
    const first = taskItems[0]
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
        <p className="text-sm font-medium text-theme-secondary">Výkony podle ceníku</p>
        {!disabled && (
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4" />Přidat položku
          </Button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-theme-muted">Přidejte položky z osobního ceníku.</p>
      ) : (
        <div className="space-y-2">
          {lines.map((line, index) => {
            const item = taskItems.find((p) => p.id === line.price_item_id)
            const unitLabel = item ? getQuantityLabel(item.unit_type) : 'množství'

            return (
              <div key={index} className="neon-border grid gap-2 rounded-xl p-3 sm:grid-cols-[1fr_120px_auto]">
                <Select
                  label="Položka ceníku"
                  options={options}
                  value={line.price_item_id}
                  disabled={disabled}
                  onChange={(e) => updateLine(index, { price_item_id: e.target.value })}
                />
                <Input
                  label={`Množství (${unitLabel})`}
                  type="number"
                  min="0"
                  step="0.1"
                  value={line.quantity}
                  disabled={disabled}
                  onChange={(e) => updateLine(index, { quantity: parseFloat(e.target.value) || 0 })}
                />
                {!disabled && (
                  <div className="flex items-end pb-1">
                    <Button type="button" variant="danger" size="sm" onClick={() => removeLine(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

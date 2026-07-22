import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { calculateLineTotal } from '@/lib/invoices/calculations'
import { formatCurrency } from '@/constants/workers'
import { INVOICE_UNITS, type InvoiceLineInput, type InvoiceVatMode } from '@/types/invoices'

interface InvoiceLineItemsEditorProps {
  lines: InvoiceLineInput[]
  vatMode: InvoiceVatMode
  onChange: (lines: InvoiceLineInput[]) => void
}

const UNIT_OPTIONS = INVOICE_UNITS.map((unit) => ({ value: unit, label: unit }))

const LINE_VAT_OPTIONS = [
  { value: '21', label: '21 %' },
  { value: '12', label: '12 %' },
  { value: '0', label: '0 %' },
]

function defaultLineVat(vatMode: InvoiceVatMode): number | null {
  if (vatMode === 'none') return 0
  return Number(vatMode)
}

function emptyLine(vatMode: InvoiceVatMode): InvoiceLineInput {
  return { name: '', quantity: 1, unit: 'ks', unit_price: 0, vat_rate: defaultLineVat(vatMode) }
}

export function InvoiceLineItemsEditor({ lines, vatMode, onChange }: InvoiceLineItemsEditorProps) {
  function updateLine(index: number, patch: Partial<InvoiceLineInput>) {
    const next = lines.map((line, i) => (i === index ? { ...line, ...patch } : line))
    onChange(next)
  }

  function addLine() {
    onChange([...lines, emptyLine(vatMode)])
  }

  function removeLine(index: number) {
    if (lines.length <= 1) {
      onChange([emptyLine(vatMode)])
      return
    }
    onChange(lines.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border-glass)] text-left text-theme-muted">
              <th className="px-2 py-2">Název</th>
              <th className="px-2 py-2">Množství</th>
              <th className="px-2 py-2">MJ</th>
              <th className="px-2 py-2">Cena</th>
              <th className="px-2 py-2">DPH</th>
              <th className="px-2 py-2 text-right">Celkem</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const total = calculateLineTotal(line.quantity, line.unit_price)
              const lineVat = line.vat_rate ?? defaultLineVat(vatMode) ?? 0
              return (
                <tr key={index} className="border-b border-[var(--border-glass)]/60">
                  <td className="px-2 py-2">
                    <Input
                      value={line.name}
                      onChange={(e) => updateLine(index, { name: e.target.value })}
                      placeholder="Název položky"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Select
                      options={UNIT_OPTIONS}
                      value={line.unit}
                      onChange={(e) => updateLine(index, { unit: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    {vatMode === 'none' ? (
                      <span className="block px-2 py-2.5 text-theme-muted">—</span>
                    ) : (
                      <Select
                        options={LINE_VAT_OPTIONS}
                        value={String(lineVat)}
                        onChange={(e) => updateLine(index, { vat_rate: Number(e.target.value) })}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 pt-6 text-right font-medium">{formatCurrency(total)}</td>
                  <td className="px-2 py-2 pt-4">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(index)} aria-label="Odebrat položku">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {lines.map((line, index) => {
          const total = calculateLineTotal(line.quantity, line.unit_price)
          const lineVat = line.vat_rate ?? defaultLineVat(vatMode) ?? 0
          return (
            <div key={index} className="rounded-xl border border-[var(--border-glass)] p-3">
              <Input
                label="Název položky"
                value={line.name}
                onChange={(e) => updateLine(index, { name: e.target.value })}
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Input
                  label="Množství"
                  type="number"
                  min={0}
                  step="0.001"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                />
                <Select
                  label="MJ"
                  options={UNIT_OPTIONS}
                  value={line.unit}
                  onChange={(e) => updateLine(index, { unit: e.target.value })}
                />
                <Input
                  label="Cena za jednotku"
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unit_price}
                  onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) || 0 })}
                />
                {vatMode === 'none' ? (
                  <div className="pb-2">
                    <p className="mb-1.5 text-sm font-medium text-theme-secondary">DPH</p>
                    <p className="text-theme-muted">—</p>
                  </div>
                ) : (
                  <Select
                    label="DPH"
                    options={LINE_VAT_OPTIONS}
                    value={String(lineVat)}
                    onChange={(e) => updateLine(index, { vat_rate: Number(e.target.value) })}
                  />
                )}
                <div className="col-span-2 flex items-end justify-between pb-2">
                  <div>
                    <p className="text-xs text-theme-muted">Celkem</p>
                    <p className="font-semibold text-theme-primary">{formatCurrency(total)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Button type="button" variant="secondary" onClick={addLine} className="w-full sm:w-auto">
        <Plus className="h-4 w-4" />
        Přidat položku
      </Button>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import {
  fetchPriceItems,
  createPriceItem,
  updatePriceItem,
  deletePriceItem,
  reorderPriceItems,
} from '@/lib/workers/api'
import type { WorkerPriceItem, PriceUnitType } from '@/types/workers'
import { PRICE_UNIT_LABELS, formatCurrency } from '@/constants/workers'

interface PriceListTabProps {
  workerId: string
  isAdmin: boolean
}

const unitOptions = (Object.keys(PRICE_UNIT_LABELS) as PriceUnitType[]).map((k) => ({
  value: k,
  label: PRICE_UNIT_LABELS[k],
}))

export function PriceListTab({ workerId, isAdmin }: PriceListTabProps) {
  const [items, setItems] = useState<WorkerPriceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState<PriceUnitType>('hodina')
  const [newPrice, setNewPrice] = useState('0')

  async function load() {
    setLoading(true)
    const data = await fetchPriceItems(workerId)
    setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [workerId])

  const visibleItems = isAdmin ? items : items.filter((i) => i.is_active !== false)

  async function withSave(action: () => Promise<void>) {
    setSaving(true)
    try {
      await action()
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd() {
    if (!newName.trim()) return
    await withSave(async () => {
      await createPriceItem(workerId, {
        name: newName.trim(),
        unit_type: newUnit,
        price: parseFloat(newPrice) || 0,
      })
      setNewName('')
      setNewPrice('0')
    })
  }

  async function handleFieldChange(
    id: string,
    updates: Partial<Pick<WorkerPriceItem, 'name' | 'unit_type' | 'price' | 'is_active'>>
  ) {
    await withSave(() => updatePriceItem(id, updates))
  }

  async function handleDelete(id: string) {
    if (!confirm('Smazat položku z osobního ceníku?')) return
    await withSave(() => deletePriceItem(id))
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= items.length) return

    const reordered = [...items]
    const temp = reordered[index]
    reordered[index] = reordered[target]
    reordered[target] = temp

    setItems(reordered)
    await withSave(() => reorderPriceItems(workerId, reordered.map((i) => i.id)))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-3 text-sm text-theme-secondary">
        Osobní ceník se automaticky načítá do docházky, formuláře dělníka, výkazů, mezd a výplatních pásek. Změna ceny se projeví okamžitě ve všech modulech.
      </p>

      <DataTable
        columns={[
          ...(isAdmin ? [{ key: 'order', label: 'Pořadí', className: 'w-24' }] : []),
          { key: 'name', label: 'Název práce' },
          { key: 'unit', label: 'Jednotka' },
          { key: 'price', label: 'Cena' },
          ...(isAdmin ? [{ key: 'active', label: 'Stav' }] : []),
          ...(isAdmin ? [{ key: 'actions', label: 'Akce', className: 'text-right' }] : []),
        ]}
        isEmpty={visibleItems.length === 0}
      >
        {visibleItems.map((item) => {
          const fullIndex = items.findIndex((i) => i.id === item.id)

          return (
            <DataTableRow key={item.id}>
              {isAdmin && (
                <DataTableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={saving || fullIndex === 0}
                      onClick={() => handleMove(fullIndex, 'up')}
                      aria-label="Posunout nahoru"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={saving || fullIndex === items.length - 1}
                      onClick={() => handleMove(fullIndex, 'down')}
                      aria-label="Posunout dolů"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </DataTableCell>
              )}
              <DataTableCell>
                {isAdmin ? (
                  <Input
                    value={item.name}
                    disabled={saving}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row) => (row.id === item.id ? { ...row, name: e.target.value } : row))
                      )
                    }
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (!value) {
                        void load()
                        return
                      }
                      void withSave(() => updatePriceItem(item.id, { name: value }))
                    }}
                  />
                ) : (
                  item.name
                )}
              </DataTableCell>
              <DataTableCell>
                {isAdmin ? (
                  <Select
                    options={unitOptions}
                    value={item.unit_type}
                    disabled={saving}
                    onChange={(e) => handleFieldChange(item.id, { unit_type: e.target.value as PriceUnitType })}
                  />
                ) : (
                  PRICE_UNIT_LABELS[item.unit_type]
                )}
              </DataTableCell>
              <DataTableCell>
                {isAdmin ? (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    disabled={saving}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row) =>
                          row.id === item.id ? { ...row, price: parseFloat(e.target.value) || 0 } : row
                        )
                      )
                    }
                    onBlur={(e) => {
                      const price = parseFloat(e.target.value) || 0
                      void withSave(() => updatePriceItem(item.id, { price }))
                    }}
                    className="max-w-[120px]"
                  />
                ) : (
                  formatCurrency(item.price)
                )}
              </DataTableCell>
              {isAdmin && (
                <DataTableCell>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleFieldChange(item.id, { is_active: !item.is_active })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      item.is_active
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {item.is_active ? 'Aktivní' : 'Neaktivní'}
                  </button>
                </DataTableCell>
              )}
              {isAdmin && (
                <DataTableCell className="text-right">
                  <Button variant="danger" size="sm" disabled={saving} onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DataTableCell>
              )}
            </DataTableRow>
          )
        })}
      </DataTable>

      {isAdmin && (
        <Card>
          <h3 className="mb-4 font-semibold text-theme-primary">Přidat položku ceníku</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <Input
              label="Název práce"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="sm:col-span-2"
            />
            <Select
              label="Jednotka"
              options={unitOptions}
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value as PriceUnitType)}
            />
            <Input
              label="Cena"
              type="number"
              min="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
          </div>
          <Button className="mt-4" disabled={saving || !newName.trim()} onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Přidat
          </Button>
        </Card>
      )}
    </div>
  )
}

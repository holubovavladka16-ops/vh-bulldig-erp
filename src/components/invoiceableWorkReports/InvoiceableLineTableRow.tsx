import { memo, useState } from 'react'
import { Check, Copy, Pencil, Trash2, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { InvoiceableItemSearchSelect } from '@/components/invoiceableWorkReports/InvoiceableItemSearchSelect'
import { generatePriceSteps } from '@/lib/invoiceableWorkReports/pricing'
import { formatCurrency, formatDate } from '@/constants/workers'
import type { CreateInvoiceableLineInput, InvoiceableItem, InvoiceableWorkReportLine, OrderOption } from '@/types/invoiceableWorkReports'

const CUSTOM_PRICE_VALUE = '__custom__'

interface InvoiceableLineTableRowProps {
  line: InvoiceableWorkReportLine
  orders: OrderOption[]
  items: InvoiceableItem[]
  isEditing: boolean
  editable: boolean
  onStartEdit: (lineId: string) => void
  onCancelEdit: () => void
  onSave: (line: InvoiceableWorkReportLine, input: CreateInvoiceableLineInput) => Promise<void>
  onDuplicate: (line: InvoiceableWorkReportLine) => void
  onDelete: (line: InvoiceableWorkReportLine) => void
}

function InvoiceableLineTableRowComponent({
  line,
  orders,
  items,
  isEditing,
  editable,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDuplicate,
  onDelete,
}: InvoiceableLineTableRowProps) {
  const [orderId, setOrderId] = useState(line.order_id)
  const [itemId, setItemId] = useState(line.item_id ?? '')
  const [workDate, setWorkDate] = useState(line.work_date)
  const [quantity, setQuantity] = useState(String(line.quantity))
  const [priceSelection, setPriceSelection] = useState(String(line.unit_price))
  const [customPrice, setCustomPrice] = useState(String(line.unit_price))
  const [note, setNote] = useState(line.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedItem = items.find((i) => i.id === itemId) ?? null
  const priceOptions = selectedItem
    ? [
        ...generatePriceSteps(selectedItem).map((v) => ({ value: String(v), label: formatCurrency(v) })),
        ...(selectedItem.allow_custom_price ? [{ value: CUSTOM_PRICE_VALUE, label: 'Vlastní cena…' }] : []),
      ]
    : []
  const isCustomPrice = priceSelection === CUSTOM_PRICE_VALUE
  const effectivePrice = isCustomPrice ? parseFloat(customPrice) : parseFloat(priceSelection)
  const quantityNumber = parseFloat(quantity)

  function resetToLine() {
    setOrderId(line.order_id)
    setItemId(line.item_id ?? '')
    setWorkDate(line.work_date)
    setQuantity(String(line.quantity))
    setPriceSelection(String(line.unit_price))
    setCustomPrice(String(line.unit_price))
    setNote(line.note ?? '')
    setError('')
  }

  function handleCancel() {
    resetToLine()
    onCancelEdit()
  }

  async function handleSave() {
    setError('')
    if (!orderId || !workDate || !itemId || !selectedItem) {
      setError('Vyplňte datum, zakázku a položku.')
      return
    }
    if (Number.isNaN(quantityNumber) || quantityNumber <= 0) {
      setError('Množství musí být kladné.')
      return
    }
    if (Number.isNaN(effectivePrice) || effectivePrice < 0) {
      setError('Vyberte nebo zadejte platnou cenu.')
      return
    }

    setSaving(true)
    try {
      await onSave(line, {
        order_id: orderId,
        work_date: workDate,
        item_id: itemId,
        item_name: selectedItem.name,
        item_category: selectedItem.category,
        unit: selectedItem.unit,
        quantity: quantityNumber,
        unit_price: effectivePrice,
        note: note.trim() || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  if (isEditing) {
    return (
      <DataTableRow>
        <td colSpan={8} className="px-4 py-3 text-theme-primary">
          <div className="space-y-3 py-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Datum" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
              <Select
                label="Zakázka"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                options={orders.map((o) => ({ value: o.id, label: o.name }))}
              />
              <InvoiceableItemSearchSelect items={items} value={itemId} onChange={setItemId} />
              <Input label="Jednotka" value={selectedItem?.unit ?? line.unit} readOnly disabled />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Množství" type="number" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <Select
                label="Cena za MJ"
                value={priceSelection}
                onChange={(e) => setPriceSelection(e.target.value)}
                options={priceOptions}
              />
              {isCustomPrice && (
                <Input label="Vlastní cena" type="number" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} />
              )}
              <Input label="Poznámka" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleSave} loading={saving}>
                <Check className="h-4 w-4" />
                Uložit
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4" />
                Zrušit
              </Button>
            </div>
          </div>
        </td>
      </DataTableRow>
    )
  }

  return (
    <DataTableRow>
      <DataTableCell>{formatDate(line.work_date)}</DataTableCell>
      <DataTableCell>{line.order_name ?? '—'}</DataTableCell>
      <DataTableCell>
        {line.item_name}
        {line.item_category && <div className="text-xs text-theme-muted">{line.item_category}</div>}
      </DataTableCell>
      <DataTableCell>{line.unit}</DataTableCell>
      <DataTableCell className="text-right">{line.quantity}</DataTableCell>
      <DataTableCell className="text-right">{formatCurrency(line.unit_price)}</DataTableCell>
      <DataTableCell className="text-right font-medium">{formatCurrency(line.line_total)}</DataTableCell>
      <DataTableCell>
        {editable && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onStartEdit(line.id)} aria-label="Upravit řádek">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDuplicate(line)} aria-label="Kopírovat řádek">
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300"
              onClick={() => onDelete(line)}
              aria-label="Smazat řádek"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DataTableCell>
    </DataTableRow>
  )
}

/**
 * Zabaleno v React.memo – při stovkách/tisících řádků se překreslí jen ten
 * řádek, jehož vlastní data (line) nebo režim editace se skutečně změnily,
 * ne celá tabulka. Vyžaduje, aby volající předával stabilní (useCallback)
 * onSave/onDuplicate/onDelete/onStartEdit funkce – viz InvoiceableWorkReportEditorPage.
 */
export const InvoiceableLineTableRow = memo(InvoiceableLineTableRowComponent)

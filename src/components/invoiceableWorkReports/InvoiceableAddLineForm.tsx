import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { InvoiceableItemSearchSelect } from '@/components/invoiceableWorkReports/InvoiceableItemSearchSelect'
import { InvoiceableItemQuickAddModal } from '@/components/invoiceableWorkReports/InvoiceableItemQuickAddModal'
import { fetchRememberedPrice } from '@/lib/invoiceableWorkReports/api'
import { generatePriceSteps, roundPrice } from '@/lib/invoiceableWorkReports/pricing'
import { todayIsoDate } from '@/lib/dates'
import { formatCurrency } from '@/constants/workers'
import type { CreateInvoiceableLineInput, InvoiceableItem, OrderOption } from '@/types/invoiceableWorkReports'

interface InvoiceableAddLineFormProps {
  reportId: string
  orders: OrderOption[]
  items: InvoiceableItem[]
  onItemCreated: (item: InvoiceableItem) => void
  onSubmit: (input: CreateInvoiceableLineInput) => Promise<void>
}

const CUSTOM_PRICE_VALUE = '__custom__'

interface DraftLineState {
  orderId: string
  itemId: string
  workDate: string
  quantity: string
  note: string
}

function draftStorageKey(reportId: string): string {
  return `invoiceable-draft-line:${reportId}`
}

function loadDraft(reportId: string): DraftLineState | null {
  try {
    const raw = window.localStorage.getItem(draftStorageKey(reportId))
    return raw ? (JSON.parse(raw) as DraftLineState) : null
  } catch {
    return null
  }
}

function saveDraft(reportId: string, draft: DraftLineState): void {
  try {
    window.localStorage.setItem(draftStorageKey(reportId), JSON.stringify(draft))
  } catch {
    // Lokální úložiště nemusí být dostupné (např. soukromé prohlížení) – ticho ignorujeme.
  }
}

function clearDraft(reportId: string): void {
  try {
    window.localStorage.removeItem(draftStorageKey(reportId))
  } catch {
    // viz výše
  }
}

/**
 * Rychlé přidávání řádků výkazu – vyhledávání položky z ceníku, automatické
 * načtení jednotky, inteligentní výběr ceny (naposledy použitá cena na
 * zakázce, výchozí cena, nebo cenový rozsah/vlastní cena). Po přidání
 * řádku zůstává datum i zakázka vyplněná, aby šlo rychle zapsat víc řádků
 * za sebou. Rozepsaný, ještě neodeslaný řádek se ukládá lokálně a při
 * návratu na stránku (např. po nechtěném zavření) se nabídne k obnovení.
 */
export function InvoiceableAddLineForm({ reportId, orders, items, onItemCreated, onSubmit }: InvoiceableAddLineFormProps) {
  const initialDraft = loadDraft(reportId)
  const [orderId, setOrderId] = useState(initialDraft?.orderId ?? '')
  const [itemId, setItemId] = useState(initialDraft?.itemId ?? '')
  const [workDate, setWorkDate] = useState(initialDraft?.workDate ?? todayIsoDate())
  const [quantity, setQuantity] = useState(initialDraft?.quantity ?? '')
  const [priceSelection, setPriceSelection] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [note, setNote] = useState(initialDraft?.note ?? '')
  const [rememberedNote, setRememberedNote] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [restoredNotice] = useState(() => Boolean(initialDraft && (initialDraft.itemId || initialDraft.quantity || initialDraft.note)))

  useEffect(() => {
    saveDraft(reportId, { orderId, itemId, workDate, quantity, note })
  }, [reportId, orderId, itemId, workDate, quantity, note])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (itemId || quantity.trim() || note.trim()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [itemId, quantity, note])

  const selectedItem = items.find((i) => i.id === itemId) ?? null

  useEffect(() => {
    if (!orderId || !itemId) {
      setRememberedNote('')
      return
    }
    let cancelled = false

    fetchRememberedPrice(orderId, itemId)
      .then((remembered) => {
        if (cancelled) return
        const item = items.find((i) => i.id === itemId)
        if (remembered) {
          setPriceSelection(String(remembered.last_unit_price))
          setRememberedNote(`Naposledy použitá cena na této zakázce: ${formatCurrency(remembered.last_unit_price)}`)
        } else if (item) {
          setPriceSelection(String(item.default_price))
          setRememberedNote('')
        }
      })
      .catch(() => {
        setRememberedNote('')
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, itemId])

  const priceOptions = selectedItem
    ? [
        ...generatePriceSteps(selectedItem).map((v) => ({ value: String(v), label: formatCurrency(v) })),
        ...(selectedItem.allow_custom_price ? [{ value: CUSTOM_PRICE_VALUE, label: 'Vlastní cena…' }] : []),
      ]
    : []

  const isCustomPrice = priceSelection === CUSTOM_PRICE_VALUE
  const effectivePrice = isCustomPrice ? parseFloat(customPrice) : parseFloat(priceSelection)
  const quantityNumber = parseFloat(quantity)
  const lineTotalPreview =
    !Number.isNaN(effectivePrice) && !Number.isNaN(quantityNumber) ? roundPrice(effectivePrice * quantityNumber) : null

  function handleItemChange(value: string) {
    setItemId(value)
    setPriceSelection('')
    setCustomPrice('')
    const item = items.find((i) => i.id === value)
    if (item) setPriceSelection(String(item.default_price))
  }

  function handleItemCreated(item: InvoiceableItem) {
    onItemCreated(item)
    setQuickAddOpen(false)
    handleItemChange(item.id)
  }

  async function handleSubmit() {
    setError('')

    if (!orderId || !workDate || !itemId || !selectedItem) {
      setError('Vyplňte datum, zakázku a položku.')
      return
    }
    if (Number.isNaN(quantityNumber) || quantityNumber <= 0) {
      setError('Množství musí být kladné číslo.')
      return
    }
    if (Number.isNaN(effectivePrice) || effectivePrice < 0) {
      setError('Vyberte nebo zadejte platnou cenu.')
      return
    }

    setSaving(true)
    try {
      await onSubmit({
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

      // Datum a zakázka zůstávají – rychlé zapsání dalšího řádku na stejný den/zakázku.
      setItemId('')
      setQuantity('')
      setPriceSelection('')
      setCustomPrice('')
      setNote('')
      setRememberedNote('')
      clearDraft(reportId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Řádek se nepodařilo uložit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-[var(--border-glass)] p-3"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">Přidat řádek</p>
      {restoredNotice && (
        <p className="text-xs text-[var(--accent-primary)]">Obnoven rozepsaný, dosud neuložený řádek.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Datum *" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
        <Select
          label="Zakázka *"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          options={[{ value: '', label: '— Vyberte zakázku —' }, ...orders.map((o) => ({ value: o.id, label: o.name }))]}
        />
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <InvoiceableItemSearchSelect items={items} value={itemId} onChange={handleItemChange} />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setQuickAddOpen(true)} aria-label="Přidat novou položku">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Input label="Jednotka" value={selectedItem?.unit ?? ''} readOnly disabled />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Množství *"
          type="number"
          step="0.001"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={!selectedItem}
        />
        <div>
          <Select
            label="Cena za MJ *"
            value={priceSelection}
            onChange={(e) => setPriceSelection(e.target.value)}
            options={[{ value: '', label: '— Vyberte cenu —' }, ...priceOptions]}
            disabled={!selectedItem}
          />
          {rememberedNote && <p className="mt-1 text-xs text-[var(--accent-primary)]">{rememberedNote}</p>}
        </div>
        {isCustomPrice && (
          <Input
            label="Vlastní cena za MJ *"
            type="number"
            step="0.01"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
          />
        )}
        <Input label="Poznámka" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Volitelné" />
        <div className="flex flex-col justify-end">
          <p className="text-xs text-theme-muted">Celkem za řádek</p>
          <p className="text-lg font-semibold text-theme-primary">
            {lineTotalPreview != null ? formatCurrency(lineTotalPreview) : '—'}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" loading={saving}>
        <Plus className="h-4 w-4" />
        Přidat řádek
      </Button>

      {quickAddOpen && (
        <InvoiceableItemQuickAddModal onCreated={handleItemCreated} onClose={() => setQuickAddOpen(false)} />
      )}
    </form>
  )
}

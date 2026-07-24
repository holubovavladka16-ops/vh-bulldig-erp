import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { CreateInvoiceableItemInput, InvoiceableItem } from '@/types/invoiceableWorkReports'
import { createItem } from '@/lib/invoiceableWorkReports/api'
import { useEscapeKey } from '@/lib/invoiceableWorkReports/useEscapeKey'
import { useAuth } from '@/context/AuthContext'

interface InvoiceableItemQuickAddModalProps {
  onCreated: (item: InvoiceableItem) => void
  onClose: () => void
}

/**
 * Přímé přidání nové fakturační položky během zápisu řádku.
 * Po uložení se položka okamžitě vrátí volajícímu, který ji vybere do
 * aktuálního řádku – žádné omezení počtu vlastních položek.
 */
export function InvoiceableItemQuickAddModal({ onCreated, onClose }: InvoiceableItemQuickAddModalProps) {
  useEscapeKey(onClose)
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [priceStep, setPriceStep] = useState('10')
  const [defaultPrice, setDefaultPrice] = useState('')
  const [allowCustomPrice, setAllowCustomPrice] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!user) return
    setError('')

    const from = parseFloat(priceFrom)
    const to = parseFloat(priceTo)
    const step = parseFloat(priceStep)
    const defaultVal = parseFloat(defaultPrice)

    if (!name.trim() || !unit.trim()) {
      setError('Vyplňte název a měrnou jednotku.')
      return
    }
    if ([from, to, step, defaultVal].some((n) => Number.isNaN(n))) {
      setError('Vyplňte platné ceny (od, do, krok, výchozí).')
      return
    }
    if (from < 0 || to < from || step <= 0) {
      setError('Cena „do“ musí být větší nebo rovna ceně „od“ a krok musí být kladný.')
      return
    }
    if (defaultVal < from || defaultVal > to) {
      setError('Výchozí cena musí ležet v rozsahu od–do.')
      return
    }

    const input: CreateInvoiceableItemInput = {
      name: name.trim(),
      category: category.trim(),
      unit: unit.trim(),
      price_from: from,
      price_to: to,
      price_step: step,
      default_price: defaultVal,
      allow_custom_price: allowCustomPrice,
    }

    setSaving(true)
    try {
      const created = await createItem(input, user.id)
      onCreated(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Položku se nepodařilo uložit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault()
        }
      }}
    >
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel glass-panel neon-border scrollbar-premium">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">Přidat novou položku</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <Input label="Název položky *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Např. Ruční výkop 60 cm" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Kategorie" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Např. Výkopové práce" />
            <Input label="Měrná jednotka *" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Např. bm, ks, hod" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Cena od *" type="number" step="0.01" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} />
            <Input label="Cena do *" type="number" step="0.01" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} />
            <Input label="Krok *" type="number" step="0.01" value={priceStep} onChange={(e) => setPriceStep(e.target.value)} />
          </div>
          <Input label="Výchozí cena *" type="number" step="0.01" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} />

          <label className="flex items-center gap-2 text-sm text-theme-secondary">
            <input
              type="checkbox"
              checked={allowCustomPrice}
              onChange={(e) => setAllowCustomPrice(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            Povolit vlastní cenu mimo rozsah
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="modal-footer pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="button" onClick={handleSave} loading={saving}>
            Uložit položku
          </Button>
        </div>
      </div>
    </div>
  )
}

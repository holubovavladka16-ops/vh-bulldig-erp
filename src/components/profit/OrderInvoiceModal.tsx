import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import type { OrderInvoiceCreateInput } from '@/types/profit'

interface OrderOption {
  value: string
  label: string
}

interface OrderInvoiceModalProps {
  open: boolean
  orderOptions: OrderOption[]
  defaultOrderId?: string
  onClose: () => void
  onSubmit: (input: OrderInvoiceCreateInput) => Promise<void>
}

const emptyForm: OrderInvoiceCreateInput = {
  order_id: '',
  invoice_date: '',
  invoice_number: '',
  amount: 0,
  note: '',
}

export function OrderInvoiceModal({
  open,
  orderOptions,
  defaultOrderId,
  onClose,
  onSubmit,
}: OrderInvoiceModalProps) {
  const [form, setForm] = useState<OrderInvoiceCreateInput>(emptyForm)
  const [amountInput, setAmountInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm({
      ...emptyForm,
      order_id: defaultOrderId ?? '',
      invoice_date: new Date().toISOString().slice(0, 10),
    })
    setAmountInput('')
    setError('')
  }, [open, defaultOrderId])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const amount = parseFloat(amountInput.replace(',', '.'))
    if (!form.order_id || !form.invoice_date || Number.isNaN(amount) || amount < 0) {
      setError('Vyplňte zakázku, datum fakturace a kladnou částku.')
      return
    }

    setLoading(true)
    try {
      await onSubmit({ ...form, amount })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  const orderSelectOptions = [{ value: '', label: '— Vyberte zakázku —' }, ...orderOptions]

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-md glass-panel neon-border scrollbar-premium">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">Zadat fakturaci</h2>
          <button onClick={onClose} className="touch-target rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Zakázka *"
            options={orderSelectOptions}
            value={form.order_id}
            onChange={(e) => setForm((prev) => ({ ...prev, order_id: e.target.value }))}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Datum fakturace *"
              type="date"
              value={form.invoice_date}
              onChange={(e) => setForm((prev) => ({ ...prev, invoice_date: e.target.value }))}
              required
            />
            <Input
              label="Číslo faktury"
              value={form.invoice_number ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, invoice_number: e.target.value }))}
            />
          </div>
          <Input
            label="Vyfakturovaná částka *"
            type="number"
            min="0"
            step="0.01"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            required
          />
          <Textarea
            label="Poznámka"
            value={form.note ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="modal-footer pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
            <Button type="submit" loading={loading}>Uložit fakturaci</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

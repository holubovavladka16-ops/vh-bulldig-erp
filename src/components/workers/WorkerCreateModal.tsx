import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { fetchActiveJobOrders } from '@/lib/orders/api'
import type { WorkerCreateInput, EmploymentType } from '@/types/workers'
import { EMPLOYMENT_TYPE_LABELS } from '@/constants/workers'

interface WorkerCreateModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: WorkerCreateInput, photoFile?: File) => Promise<void>
}

const employmentOptions = (Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map((key) => ({
  value: key,
  label: EMPLOYMENT_TYPE_LABELS[key],
}))

const emptyForm: WorkerCreateInput = {
  first_name: '',
  last_name: '',
  address: '',
  birth_date: '',
  start_date: '',
  employment_type: 'HPP',
  position: '',
  assigned_order: '',
  assigned_order_id: null,
  phone: '',
  email: '',
  birth_number: '',
  nationality: '',
  note: '',
}

export function WorkerCreateModal({ open, onClose, onSubmit }: WorkerCreateModalProps) {
  const [form, setForm] = useState<WorkerCreateInput>(emptyForm)
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([{ value: '', label: '— Bez zakázky —' }])
  const [photoFile, setPhotoFile] = useState<File | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    fetchActiveJobOrders()
      .then((orders) =>
        setOrderOptions([
          { value: '', label: '— Bez zakázky —' },
          ...orders.map((o) => ({ value: o.id, label: `${o.name} (${o.location})` })),
        ])
      )
      .catch(() => {})
  }, [open])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onSubmit(form, photoFile)
      setForm(emptyForm)
      setPhotoFile(undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrace se nezdařila')
    } finally {
      setLoading(false)
    }
  }

  function updateField<K extends keyof WorkerCreateInput>(key: K, value: WorkerCreateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-md glass-panel neon-border scrollbar-premium">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">Nový zaměstnanec</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Jméno *" value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} required />
            <Input label="Příjmení *" value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} required />
            <Input label="Pracovní pozice *" value={form.position} onChange={(e) => updateField('position', e.target.value)} required className="sm:col-span-2" />
            <Select
              label="Zakázka"
              options={orderOptions}
              value={form.assigned_order_id ?? ''}
              onChange={(e) => {
                const orderId = e.target.value || null
                const option = orderOptions.find((o) => o.value === e.target.value)
                const orderName = option?.label.split(' (')[0] ?? ''
                setForm({
                  ...form,
                  assigned_order_id: orderId,
                  assigned_order: orderId ? orderName : '',
                })
              }}
              className="sm:col-span-2"
            />
            <Select label="Pracovní poměr *" options={employmentOptions} value={form.employment_type} onChange={(e) => updateField('employment_type', e.target.value as EmploymentType)} required />
            <Input label="Datum narození *" type="date" value={form.birth_date} onChange={(e) => updateField('birth_date', e.target.value)} required />
            <Input label="Datum nástupu *" type="date" value={form.start_date} onChange={(e) => updateField('start_date', e.target.value)} required />
            <Input label="Adresa *" value={form.address} onChange={(e) => updateField('address', e.target.value)} required className="sm:col-span-2" />
            <Input label="Telefon" value={form.phone ?? ''} onChange={(e) => updateField('phone', e.target.value)} />
            <Input label="E-mail" type="email" value={form.email ?? ''} onChange={(e) => updateField('email', e.target.value)} />
            <Input label="Rodné číslo" value={form.birth_number ?? ''} onChange={(e) => updateField('birth_number', e.target.value)} />
            <Input label="Státní příslušnost" value={form.nationality ?? ''} onChange={(e) => updateField('nationality', e.target.value)} />
          </div>

          <Textarea label="Poznámka" value={form.note ?? ''} onChange={(e) => updateField('note', e.target.value)} />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-theme-secondary">Fotografie</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0])}
              className="input-glass w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          <div className="modal-footer pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
            <Button type="submit" loading={loading}>Vytvořit zaměstnance</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

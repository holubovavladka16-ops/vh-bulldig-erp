import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { GpsCapture } from '@/components/portal/GpsCapture'
import type { JobOrder, JobOrderCreateInput, JobOrderStatus } from '@/types/orders'
import { JOB_ORDER_STATUS_OPTIONS } from '@/constants/orders'

interface OrderFormModalProps {
  open: boolean
  initial?: JobOrder | null
  onClose: () => void
  onSubmit: (data: JobOrderCreateInput) => Promise<void>
}

const emptyForm: JobOrderCreateInput = {
  name: '',
  location: '',
  work_description: '',
  start_date: '',
  end_date: '',
  order_number: '',
  short_code: '',
  investor: '',
  client_name: '',
  contact_person: '',
  phone: '',
  email: '',
  note: '',
  status: 'pripravuje_se',
}

export function OrderFormModal({ open, initial, onClose, onSubmit }: OrderFormModalProps) {
  const [form, setForm] = useState<JobOrderCreateInput>(emptyForm)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        name: initial.name,
        location: initial.location,
        work_description: initial.work_description,
        start_date: initial.start_date,
        end_date: initial.end_date,
        order_number: initial.order_number ?? '',
        short_code: initial.short_code ?? '',
        investor: initial.investor ?? '',
        client_name: initial.client_name ?? '',
        contact_person: initial.contact_person ?? '',
        phone: initial.phone ?? '',
        email: initial.email ?? '',
        note: initial.note ?? '',
        status: initial.status,
      })
      setGpsLat(initial.gps_lat)
      setGpsLng(initial.gps_lng)
      setGpsAccuracy(initial.gps_accuracy)
    } else {
      setForm(emptyForm)
      setGpsLat(null)
      setGpsLng(null)
      setGpsAccuracy(null)
    }
    setError('')
  }, [open, initial])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSubmit({
        ...form,
        gps_lat: gpsLat,
        gps_lng: gpsLng,
        gps_accuracy: gpsAccuracy,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  function updateField<K extends keyof JobOrderCreateInput>(key: K, value: JobOrderCreateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-lg glass-panel neon-border scrollbar-premium">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">
            {initial ? 'Upravit zakázku' : 'Nová zakázka'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Název zakázky *" value={form.name} onChange={(e) => updateField('name', e.target.value)} required className="sm:col-span-2" />
            <Input label="Místo realizace *" value={form.location} onChange={(e) => updateField('location', e.target.value)} required className="sm:col-span-2" />
            <Textarea label="Popis prací *" value={form.work_description} onChange={(e) => updateField('work_description', e.target.value)} required className="sm:col-span-2" />
            <Input label="Datum zahájení *" type="date" value={form.start_date} onChange={(e) => updateField('start_date', e.target.value)} required />
            <Input label="Datum ukončení *" type="date" value={form.end_date} onChange={(e) => updateField('end_date', e.target.value)} required />
            <Input label="Číslo zakázky" value={form.order_number ?? ''} onChange={(e) => updateField('order_number', e.target.value)} />
            <Input label="Krátký kód (pro papírové výkazy)" value={form.short_code ?? ''} onChange={(e) => updateField('short_code', e.target.value.toUpperCase())} placeholder="BRN-024" />
            <Select label="Stav" options={JOB_ORDER_STATUS_OPTIONS} value={form.status ?? 'pripravuje_se'} onChange={(e) => updateField('status', e.target.value as JobOrderStatus)} />
            <Input label="Investor" value={form.investor ?? ''} onChange={(e) => updateField('investor', e.target.value)} />
            <Input label="Objednatel" value={form.client_name ?? ''} onChange={(e) => updateField('client_name', e.target.value)} />
            <Input label="Kontaktní osoba" value={form.contact_person ?? ''} onChange={(e) => updateField('contact_person', e.target.value)} />
            <Input label="Telefon" value={form.phone ?? ''} onChange={(e) => updateField('phone', e.target.value)} />
            <Input label="E-mail" type="email" value={form.email ?? ''} onChange={(e) => updateField('email', e.target.value)} />
            <Textarea label="Poznámka" value={form.note ?? ''} onChange={(e) => updateField('note', e.target.value)} className="sm:col-span-2" />
          </div>

          <GpsCapture
            lat={gpsLat}
            lng={gpsLng}
            accuracy={gpsAccuracy}
            onCapture={(lat, lng, accuracy) => {
              setGpsLat(lat)
              setGpsLng(lng)
              setGpsAccuracy(accuracy)
            }}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="modal-footer pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
            <Button type="submit" loading={loading}>{initial ? 'Uložit' : 'Vytvořit zakázku'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

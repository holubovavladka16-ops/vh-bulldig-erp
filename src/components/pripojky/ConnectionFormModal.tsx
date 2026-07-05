import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { ConnectionPhotoCapture, validateConnectionPhotos } from '@/components/pripojky/ConnectionPhotoCapture'
import { fetchUtilityConnectionDetail } from '@/lib/pripojky/api'
import { fetchWorkers } from '@/lib/workers/api'
import type {
  ConnectionGpsPhoto,
  PendingConnectionPhoto,
  UtilityConnection,
  UtilityConnectionCreateInput,
  UtilityConnectionWorkType,
} from '@/types/pripojky'
import { WORK_TYPE_OPTIONS } from '@/types/pripojky'

interface ConnectionFormModalProps {
  open: boolean
  initial?: UtilityConnection | null
  orderOptions: { value: string; label: string }[]
  onClose: () => void
  onSubmit: (data: UtilityConnectionCreateInput, photos: PendingConnectionPhoto[]) => Promise<void>
}

const emptyForm: UtilityConnectionCreateInput = {
  connection_date: '',
  worker_id: '',
  order_id: '',
  connection_address: '',
  work_description: '',
  length_meters: 0,
  penetration_count: 0,
  work_type: 'pripojka',
}

export function ConnectionFormModal({ open, initial, orderOptions, onClose, onSubmit }: ConnectionFormModalProps) {
  const [form, setForm] = useState<UtilityConnectionCreateInput>(emptyForm)
  const [lengthInput, setLengthInput] = useState('')
  const [penetrationInput, setPenetrationInput] = useState('')
  const [workerOptions, setWorkerOptions] = useState<{ value: string; label: string }[]>([])
  const [pendingPhotos, setPendingPhotos] = useState<PendingConnectionPhoto[]>([])
  const [existingPhotos, setExistingPhotos] = useState<ConnectionGpsPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return

    fetchWorkers('aktivni')
      .then((workers) =>
        setWorkerOptions([
          { value: '', label: '— Vyberte zaměstnance —' },
          ...workers.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` })),
        ])
      )
      .catch(() => {})

    if (initial) {
      setForm({
        connection_date: initial.connection_date,
        worker_id: initial.worker_id,
        order_id: initial.order_id,
        connection_address: initial.connection_address,
        work_description: initial.work_description,
        length_meters: initial.length_meters,
        penetration_count: initial.penetration_count,
        work_type: initial.work_type,
      })
      setLengthInput(String(initial.length_meters))
      setPenetrationInput(String(initial.penetration_count))
      fetchUtilityConnectionDetail(initial.id)
        .then((detail) => setExistingPhotos(detail?.photos ?? []))
        .catch(() => setExistingPhotos([]))
    } else {
      setForm(emptyForm)
      setLengthInput('')
      setPenetrationInput('')
      setExistingPhotos([])
    }

    setPendingPhotos([])
    setError('')
  }, [open, initial])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const lengthMeters = parseFloat(lengthInput.replace(',', '.'))
    const penetrationCount = parseInt(penetrationInput, 10)
    const photoError = validateConnectionPhotos(pendingPhotos, existingPhotos)

    if (
      !form.connection_date ||
      !form.worker_id ||
      !form.order_id ||
      !form.connection_address.trim() ||
      !form.work_description.trim() ||
      Number.isNaN(lengthMeters) ||
      lengthMeters < 0 ||
      Number.isNaN(penetrationCount) ||
      penetrationCount < 0
    ) {
      setError('Vyplňte všechna povinná pole.')
      return
    }

    if (photoError) {
      setError(photoError)
      return
    }

    setLoading(true)
    try {
      await onSubmit(
        {
          ...form,
          length_meters: lengthMeters,
          penetration_count: penetrationCount,
        },
        pendingPhotos
      )
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
      <div className="modal-panel modal-panel-lg glass-panel neon-border scrollbar-premium">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">
            {initial ? 'Upravit přípojku' : 'Nová přípojka'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Datum *" type="date" value={form.connection_date} onChange={(e) => setForm({ ...form, connection_date: e.target.value })} required />
            <Select label="Zaměstnanec *" options={workerOptions} value={form.worker_id} onChange={(e) => setForm({ ...form, worker_id: e.target.value })} required />
            <Select label="Zakázka *" options={orderSelectOptions} value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} required />
            <Select
              label="Typ práce"
              options={WORK_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={form.work_type}
              onChange={(e) => setForm({ ...form, work_type: e.target.value as UtilityConnectionWorkType })}
            />
            <Input label="Adresa přípojky *" value={form.connection_address} onChange={(e) => setForm({ ...form, connection_address: e.target.value })} required className="sm:col-span-2" />
            <Input label="Délka přípojky (m) *" type="number" min="0" step="0.01" value={lengthInput} onChange={(e) => setLengthInput(e.target.value)} required />
            <Input label="Počet průrazů *" type="number" min="0" value={penetrationInput} onChange={(e) => setPenetrationInput(e.target.value)} required />
            <Textarea label="Popis provedených prací *" value={form.work_description} onChange={(e) => setForm({ ...form, work_description: e.target.value })} required className="sm:col-span-2" />
          </div>

          {form.work_type === 'pripojka' && (
            <p className="rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3 text-sm text-theme-secondary">
              Po uložení se automaticky vytvoří nebo aktualizuje zápis ve Stavebním deníku.
            </p>
          )}

          <ConnectionPhotoCapture pendingPhotos={pendingPhotos} existingPhotos={existingPhotos} onChange={setPendingPhotos} />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="modal-footer pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
            <Button type="submit" loading={loading}>{initial ? 'Uložit' : 'Přidat přípojku'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

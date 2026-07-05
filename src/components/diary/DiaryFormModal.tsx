import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { DiaryPhotoCapture } from '@/components/diary/DiaryPhotoCapture'
import { fetchDiaryDetail } from '@/lib/diary/api'
import type { ConstructionDiaryCreateInput, ConstructionDiaryEntry, PendingDiaryPhoto } from '@/types/diary'

interface DiaryFormModalProps {
  open: boolean
  initial?: ConstructionDiaryEntry | null
  orderOptions: { value: string; label: string }[]
  onClose: () => void
  onSubmit: (data: ConstructionDiaryCreateInput, photos: PendingDiaryPhoto[]) => Promise<void>
}

const emptyForm: ConstructionDiaryCreateInput = {
  entry_date: '',
  order_id: '',
  weather: '',
  worker_count: 1,
  worker_names: '',
  equipment: '',
  work_description: '',
}

export function DiaryFormModal({ open, initial, orderOptions, onClose, onSubmit }: DiaryFormModalProps) {
  const [form, setForm] = useState<ConstructionDiaryCreateInput>(emptyForm)
  const [workerCountInput, setWorkerCountInput] = useState('1')
  const [pendingPhotos, setPendingPhotos] = useState<PendingDiaryPhoto[]>([])
  const [existingPhotos, setExistingPhotos] = useState<import('@/types/photos').GpsPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return

    if (initial) {
      setForm({
        entry_date: initial.entry_date,
        order_id: initial.order_id,
        weather: initial.weather,
        worker_count: initial.worker_count,
        worker_names: initial.worker_names,
        equipment: initial.equipment,
        work_description: initial.work_description,
      })
      setWorkerCountInput(String(initial.worker_count))
      fetchDiaryDetail(initial.id)
        .then((detail) => setExistingPhotos(detail?.photos ?? []))
        .catch(() => setExistingPhotos([]))
    } else {
      setForm(emptyForm)
      setWorkerCountInput('1')
      setExistingPhotos([])
    }

    setPendingPhotos([])
    setError('')
  }, [open, initial])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const workerCount = parseInt(workerCountInput, 10)
    if (
      !form.entry_date ||
      !form.order_id ||
      !form.weather.trim() ||
      Number.isNaN(workerCount) ||
      workerCount < 0 ||
      !form.worker_names.trim() ||
      !form.equipment.trim() ||
      !form.work_description.trim()
    ) {
      setError('Vyplňte všechna povinná pole.')
      return
    }

    setLoading(true)
    try {
      await onSubmit({ ...form, worker_count: workerCount }, pendingPhotos)
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
            {initial ? 'Upravit zápis' : 'Nový zápis stavebního deníku'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Datum *" type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} required />
            <Select label="Zakázka *" options={orderSelectOptions} value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} required />
            <Input label="Počasí *" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} required />
            <Input label="Počet dělníků *" type="number" min="0" value={workerCountInput} onChange={(e) => setWorkerCountInput(e.target.value)} required />
            <Textarea label="Jména zaměstnanců *" value={form.worker_names} onChange={(e) => setForm({ ...form, worker_names: e.target.value })} required className="sm:col-span-2" />
            <Textarea label="Použitá technika *" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} required className="sm:col-span-2" />
            <Textarea label="Popis provedených prací *" value={form.work_description} onChange={(e) => setForm({ ...form, work_description: e.target.value })} required className="sm:col-span-2" />
          </div>

          <DiaryPhotoCapture pendingPhotos={pendingPhotos} existingPhotos={existingPhotos} onChange={setPendingPhotos} />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="modal-footer pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
            <Button type="submit" loading={loading}>{initial ? 'Uložit' : 'Vytvořit zápis'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

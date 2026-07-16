import { useEffect, useState, type FormEvent } from 'react'
import { X, FileText, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import {
  fetchJobCostWithAttachments,
  openCostDocument,
  deleteJobCostDocument,
  deleteJobCostPhoto,
  getCostPhotoUrl,
} from '@/lib/costs/api'
import { JOB_COST_CATEGORY_OPTIONS } from '@/constants/costs'
import type { JobCost, JobCostCreateInput, JobCostDocument, JobCostPhoto } from '@/types/costs'

interface OrderOption {
  value: string
  label: string
}

interface CostFormModalProps {
  open: boolean
  initial?: JobCost | null
  orderOptions: OrderOption[]
  onClose: () => void
  onSubmit: (
    data: JobCostCreateInput,
    files: { pdf?: File; photos: File[] }
  ) => Promise<void>
}

const emptyForm: JobCostCreateInput = {
  cost_date: '',
  order_id: '',
  name: '',
  category: 'ostatni',
  price: 0,
  supplier: '',
  note: '',
}

export function CostFormModal({ open, initial, orderOptions, onClose, onSubmit }: CostFormModalProps) {
  const [form, setForm] = useState<JobCostCreateInput>(emptyForm)
  const [priceInput, setPriceInput] = useState('')
  const [pdfFile, setPdfFile] = useState<File | undefined>()
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [existingDocument, setExistingDocument] = useState<JobCostDocument | null>(null)
  const [existingPhotos, setExistingPhotos] = useState<JobCostPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return

    if (initial) {
      setForm({
        cost_date: initial.cost_date,
        order_id: initial.order_id,
        name: initial.name,
        category: initial.category ?? 'ostatni',
        price: initial.price,
        supplier: initial.supplier ?? '',
        note: initial.note ?? '',
      })
      setPriceInput(String(initial.price))

      fetchJobCostWithAttachments(initial.id)
        .then((detail) => {
          setExistingDocument(detail?.document ?? null)
          setExistingPhotos(detail?.photos ?? [])
        })
        .catch(() => {
          setExistingDocument(null)
          setExistingPhotos([])
        })
    } else {
      setForm(emptyForm)
      setPriceInput('')
      setExistingDocument(null)
      setExistingPhotos([])
    }

    setPdfFile(undefined)
    setPhotoFiles([])
    setError('')
  }, [open, initial])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const price = parseFloat(priceInput.replace(',', '.'))
    if (!form.cost_date || !form.order_id || !form.name.trim() || Number.isNaN(price) || price < 0) {
      setError('Vyplňte povinná pole: datum, zakázku, název a cenu.')
      return
    }

    setLoading(true)
    try {
      await onSubmit(
        { ...form, name: form.name.trim(), price },
        { pdf: pdfFile, photos: photoFiles }
      )
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  function updateField<K extends keyof JobCostCreateInput>(key: K, value: JobCostCreateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const orderSelectOptions = [{ value: '', label: '— Vyberte zakázku —' }, ...orderOptions]

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-md glass-panel neon-border scrollbar-premium">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">
            {initial ? 'Upravit náklad' : 'Nový náklad'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Datum *"
              type="date"
              value={form.cost_date}
              onChange={(e) => updateField('cost_date', e.target.value)}
              required
            />
            <Select
              label="Zakázka *"
              options={orderSelectOptions}
              value={form.order_id}
              onChange={(e) => updateField('order_id', e.target.value)}
              required
            />
            <Input
              label="Název nákladu *"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              className="sm:col-span-2"
            />
            <Select
              label="Kategorie nákladu *"
              options={JOB_COST_CATEGORY_OPTIONS}
              value={form.category}
              onChange={(e) => updateField('category', e.target.value as JobCostCreateInput['category'])}
              required
            />
            <Input
              label="Cena *"
              type="number"
              min="0"
              step="0.01"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              required
            />
            <Input
              label="Dodavatel"
              value={form.supplier ?? ''}
              onChange={(e) => updateField('supplier', e.target.value)}
            />
            <Textarea
              label="Poznámka"
              value={form.note ?? ''}
              onChange={(e) => updateField('note', e.target.value)}
              className="sm:col-span-2"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-theme-secondary">Doklad PDF</label>
            {existingDocument && (
              <div className="neon-border mb-2 flex items-center justify-between gap-3 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  <span className="text-sm text-theme-primary">{existingDocument.file_name}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => openCostDocument(existingDocument.file_path)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => deleteJobCostDocument(existingDocument).then(() => setExistingDocument(null))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0])}
              className="input-glass w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-theme-secondary">Fotografie</label>
            {existingPhotos.length > 0 && (
              <div className="mb-2 grid gap-2 sm:grid-cols-2">
                {existingPhotos.map((photo) => (
                  <div key={photo.id} className="neon-border rounded-xl p-2">
                    <img src={getCostPhotoUrl(photo.file_path)} alt={photo.file_name} className="max-h-32 w-full rounded-lg object-cover" />
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        deleteJobCostPhoto(photo).then(() =>
                          setExistingPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      Smazat
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))}
              className="input-glass w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="modal-footer pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
            <Button type="submit" loading={loading}>{initial ? 'Uložit' : 'Přidat náklad'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

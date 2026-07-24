import { useEffect, useState, type FormEvent } from 'react'
import { Camera, ImagePlus, Loader2, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { captureCurrentPosition, reverseGeocode } from '@/lib/photos/geocoding'
import { getReceiptPhotoUrl } from '@/lib/receipts/api'
import type { Receipt, ReceiptCaptureMeta, ReceiptCreateInput } from '@/types/receipts'

interface ReceiptFormModalProps {
  open: boolean
  initial?: Receipt | null
  orderOptions: { value: string; label: string }[]
  onClose: () => void
  onSubmit: (data: ReceiptCreateInput, capture: ReceiptCaptureMeta | null) => Promise<void>
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm: ReceiptCreateInput = {
  receipt_date: todayIso(),
  order_id: '',
  expense_name: '',
  amount: null,
  supplier: '',
  note: '',
}

export function ReceiptFormModal({ open, initial, orderOptions, onClose, onSubmit }: ReceiptFormModalProps) {
  const [form, setForm] = useState<ReceiptCreateInput>(emptyForm)
  const [amountInput, setAmountInput] = useState('')

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [capturedAt, setCapturedAt] = useState<Date | null>(null)
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null)
  const [address, setAddress] = useState<{ address_full: string; street: string; city: string; postal_code: string; country: string } | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEdit = Boolean(initial)

  useEffect(() => {
    if (!open) return

    if (initial) {
      setForm({
        receipt_date: initial.receipt_date,
        order_id: initial.order_id,
        expense_name: initial.expense_name,
        amount: initial.amount,
        supplier: initial.supplier ?? '',
        note: initial.note ?? '',
      })
      setAmountInput(initial.amount != null ? String(initial.amount) : '')
    } else {
      setForm(emptyForm)
      setAmountInput('')
    }

    setPreviewUrl(null)
    setFile(null)
    setCapturedAt(null)
    setGps(null)
    setAddress(null)
    setError('')
  }, [open, initial])

  if (!open) return null

  async function processFile(selected: File) {
    setError('')
    setLoadingMeta(true)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setCapturedAt(new Date())

    try {
      const position = await captureCurrentPosition()
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const accuracy = position.coords.accuracy
      setGps({ lat, lng, accuracy })
      setAddress(await reverseGeocode(lat, lng))
    } catch (err) {
      setGps(null)
      setAddress(null)
      setError(err instanceof Error ? err.message : 'GPS nebo adresa se nepodařily načíst.')
    } finally {
      setLoadingMeta(false)
    }
  }

  function updateField<K extends keyof ReceiptCreateInput>(key: K, value: ReceiptCreateInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.receipt_date || !form.order_id || !form.expense_name.trim()) {
      setError('Vyplňte povinná pole: datum, zakázku a název výdaje.')
      return
    }

    if (!isEdit && !file) {
      setError('Nejdříve vyfoťte nebo vyberte fotografii paragonu.')
      return
    }

    let amount: number | null = null
    if (amountInput.trim()) {
      const parsed = parseFloat(amountInput.replace(',', '.'))
      if (Number.isNaN(parsed) || parsed < 0) {
        setError('Cena musí být kladné číslo.')
        return
      }
      amount = parsed
    }

    setLoading(true)
    try {
      const capture: ReceiptCaptureMeta | null =
        !isEdit && file && capturedAt
          ? {
              file,
              captured_at: capturedAt,
              gps_lat: gps?.lat ?? null,
              gps_lng: gps?.lng ?? null,
              gps_accuracy: gps?.accuracy ?? null,
              address_full: address?.address_full ?? '',
              street: address?.street ?? '',
              city: address?.city ?? '',
              postal_code: address?.postal_code ?? '',
              country: address?.country ?? '',
            }
          : null

      await onSubmit(
        { ...form, expense_name: form.expense_name.trim(), amount },
        capture
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
      <div className="modal-panel modal-panel-md glass-panel neon-border scrollbar-premium">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">
            {isEdit ? 'Upravit paragon' : 'Nový paragon'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isEdit ? (
            initial && (
              <img
                src={getReceiptPhotoUrl(initial.file_path)}
                alt="Paragon"
                className="mb-2 max-h-56 w-full rounded-xl object-contain neon-border"
              />
            )
          ) : (
            <>
              <p className="text-sm text-theme-muted">
                Po výběru fotografie se automaticky uloží datum, čas, GPS a adresa pořízení.
              </p>

              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl btn-neon px-4 py-2 text-sm">
                  <Camera className="h-4 w-4" />
                  Vyfotit
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                  />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl btn-neon px-4 py-2 text-sm">
                  <ImagePlus className="h-4 w-4" />
                  Vybrat z galerie
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                  />
                </label>
              </div>

              {previewUrl && (
                <img src={previewUrl} alt="Náhled" className="max-h-56 w-full rounded-xl object-contain neon-border" />
              )}

              {loadingMeta && (
                <div className="flex items-center gap-2 text-sm text-theme-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Načítám GPS a adresu…
                </div>
              )}

              {gps && address && capturedAt && (
                <div className="neon-border grid gap-3 rounded-xl p-4 sm:grid-cols-2">
                  <Meta label="Datum pořízení" value={capturedAt.toLocaleDateString('cs-CZ')} />
                  <Meta label="Čas pořízení" value={capturedAt.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })} />
                  <Meta label="GPS" value={`${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`} />
                  <Meta label="Přesnost" value={gps.accuracy != null ? `±${Math.round(gps.accuracy)} m` : '—'} />
                  <Meta label="Adresa" value={address.address_full} className="sm:col-span-2" />
                </div>
              )}
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Datum *"
              type="date"
              value={form.receipt_date}
              onChange={(e) => updateField('receipt_date', e.target.value)}
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
              label="Název výdaje *"
              value={form.expense_name}
              onChange={(e) => updateField('expense_name', e.target.value)}
              required
              className="sm:col-span-2"
            />
            <Input
              label="Cena"
              type="number"
              min="0"
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="modal-footer pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
            <Button type="submit" loading={loading}>
              <MapPin className="h-4 w-4" />
              {isEdit ? 'Uložit' : 'Přidat paragon'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Meta({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="text-sm font-medium text-theme-primary">{value}</p>
    </div>
  )
}

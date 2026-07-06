import { useEffect, useState, useCallback } from 'react'
import { Save, User } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useAppSettings } from '@/context/AppSettingsContext'
import { toDateInputValue } from '@/lib/dates'
import { fetchWorker, updateWorker, uploadWorkerPhoto } from '@/lib/workers/api'
import { fetchActiveJobOrders } from '@/lib/orders/api'
import type { Worker, EmploymentType } from '@/types/workers'
import { EMPLOYMENT_TYPE_LABELS, WORKER_STATUS_LABELS, formatDate } from '@/constants/workers'

interface PersonalTabProps {
  worker: Worker
  isAdmin: boolean
  onUpdate: (worker: Worker) => void
}

const employmentOptions = (Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map((k) => ({
  value: k,
  label: EMPLOYMENT_TYPE_LABELS[k],
}))

function normalizeForm(worker: Worker): Worker {
  return {
    ...worker,
    birth_date: toDateInputValue(worker.birth_date),
    start_date: toDateInputValue(worker.start_date),
    end_date: worker.end_date ? toDateInputValue(worker.end_date) : null,
  }
}

export function PersonalTab({ worker, isAdmin, onUpdate }: PersonalTabProps) {
  const { settings: appSettings } = useAppSettings()
  const [form, setForm] = useState(() => normalizeForm(worker))
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoSuccess, setPhotoSuccess] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: '— Bez zakázky —' },
  ])

  useEffect(() => setForm(normalizeForm(worker)), [worker])

  useEffect(() => {
    fetchActiveJobOrders()
      .then((orders) => {
        const options = orders.map((o) => ({ value: o.id, label: `${o.name} (${o.location})` }))
        if (worker.assigned_order_id && !options.some((o) => o.value === worker.assigned_order_id)) {
          options.unshift({
            value: worker.assigned_order_id,
            label: worker.assigned_order || worker.assigned_order_id,
          })
        }
        setOrderOptions([{ value: '', label: '— Bez zakázky —' }, ...options])
      })
      .catch(() => {})
  }, [worker.assigned_order_id, worker.assigned_order])

  const persistWorker = useCallback(
    async (data: Worker) => {
      if (!data.birth_date?.trim()) {
        throw new Error('Datum narození je povinné.')
      }
      if (!data.start_date?.trim()) {
        throw new Error('Datum nástupu je povinné.')
      }
      await updateWorker(data.id, {
        first_name: data.first_name,
        last_name: data.last_name,
        address: data.address,
        birth_date: data.birth_date,
        start_date: data.start_date,
        employment_type: data.employment_type,
        position: data.position,
        assigned_order: data.assigned_order,
        assigned_order_id: data.assigned_order_id ?? null,
        phone: data.phone ?? '',
        email: data.email ?? '',
        birth_number: data.birth_number ?? '',
        nationality: data.nationality ?? '',
        note: data.note ?? '',
      })

      const fresh = await fetchWorker(data.id)
      if (fresh) {
        onUpdate(fresh)
        setForm(normalizeForm(fresh))
      }
    },
    [onUpdate]
  )

  const handleSave = useCallback(
    async (data: Worker) => {
      if (!isAdmin || !appSettings?.auto_save_enabled) return
      await persistWorker(data)
    },
    [isAdmin, appSettings?.auto_save_enabled, persistWorker]
  )

  const { status, errorMessage } = useAutoSave({
    data: form,
    onSave: handleSave,
    enabled: isAdmin && Boolean(appSettings?.auto_save_enabled),
    ready: true,
  })

  async function handleManualSave() {
    if (!isAdmin) return
    setManualSaving(true)
    try {
      await persistWorker(form)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setManualSaving(false)
    }
  }

  async function handlePhotoChange(file: File) {
    setPhotoError(null)
    setPhotoSuccess(false)
    try {
      const url = await uploadWorkerPhoto(worker.id, file)
      const fresh = await fetchWorker(worker.id)
      const next = fresh ? { ...fresh, photo_url: url } : { ...worker, photo_url: url }
      onUpdate(next)
      setForm(normalizeForm(next))
      setPhotoSuccess(true)
      setTimeout(() => setPhotoSuccess(false), 3500)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Nahrání fotografie se nezdařilo')
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AutoSaveIndicator status={status} errorMessage={errorMessage} />
        {isAdmin && !appSettings?.auto_save_enabled && (
          <Button type="button" size="sm" loading={manualSaving} onClick={handleManualSave}>
            <Save className="h-4 w-4" />
            Uložit změny
          </Button>
        )}
        {photoSuccess && (
          <p className="text-xs font-medium text-green-400">Fotografie byla úspěšně nahrána.</p>
        )}
        {photoError && <p className="max-w-full break-words text-xs text-red-400">{photoError}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            {form.photo_url ? (
              <img src={form.photo_url} alt="" className="h-32 w-32 rounded-2xl object-cover neon-border" />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-2xl neon-border bg-white/5">
                <User className="h-16 w-16 text-theme-muted" />
              </div>
            )}
            {isAdmin && (
              <label className="mt-4 cursor-pointer">
                <span className="btn-neon inline-flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm">
                  Nahrát fotografii
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePhotoChange(file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
            <h3 className="mt-4 text-xl font-bold text-theme-primary">
              {form.first_name} {form.last_name}
            </h3>
            <p className="text-theme-secondary">{form.position}</p>
            <p className="mt-2 text-sm text-theme-muted">{WORKER_STATUS_LABELS[form.status]}</p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Jméno"
              value={form.first_name}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
            <Input
              label="Příjmení"
              value={form.last_name}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
            <Input
              label="Pracovní pozice"
              value={form.position}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            />
            <Select
              label="Zakázka"
              options={orderOptions}
              value={form.assigned_order_id ?? ''}
              disabled={!isAdmin}
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
              hint="Výchozí zakázka ve formuláři zaměstnance (pouze aktivní)"
            />
            <Select
              label="Pracovní poměr"
              options={employmentOptions}
              value={form.employment_type}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, employment_type: e.target.value as EmploymentType })}
            />
            <Input
              label="Datum narození"
              type="date"
              value={form.birth_date}
              required
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
            <Input
              label="Datum nástupu"
              type="date"
              value={form.start_date}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            {form.end_date && <Input label="Datum ukončení" value={formatDate(form.end_date)} disabled />}
            <Input
              label="Adresa"
              value={form.address}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="sm:col-span-2"
            />
            <Input
              label="Telefon"
              type="tel"
              inputMode="tel"
              value={form.phone ?? ''}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="E-mail"
              type="email"
              value={form.email ?? ''}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Rodné číslo"
              value={form.birth_number ?? ''}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, birth_number: e.target.value })}
            />
            <Input
              label="Státní příslušnost"
              value={form.nationality ?? ''}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
            />
            <Textarea
              label="Poznámka"
              value={form.note ?? ''}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="sm:col-span-2"
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, Upload } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import { useAppSettings } from '@/context/AppSettingsContext'
import { useAutoSave } from '@/hooks/useAutoSave'
import {
  fetchInvoiceSettings,
  getInvoiceAssetUrl,
  saveInvoiceSettings,
  uploadInvoiceAsset,
} from '@/lib/invoices/api'
import { DEFAULT_INVOICE_SETTINGS, type InvoiceSettings } from '@/types/invoices'

type AssetKind = 'logo' | 'signature' | 'stamp'

export function InvoiceSettingsPage() {
  const { settings: appSettings } = useAppSettings()
  const [form, setForm] = useState<InvoiceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [manualSaving, setManualSaving] = useState(false)
  const [uploading, setUploading] = useState<AssetKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoiceSettings()
      .then((data) => setForm(data ?? ({ ...DEFAULT_INVOICE_SETTINGS, id: '', created_at: '', updated_at: '' } as InvoiceSettings)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Načtení nastavení selhalo'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = useCallback(
    async (data: InvoiceSettings) => {
      if (!appSettings?.auto_save_enabled) return
      await saveInvoiceSettings(data)
    },
    [appSettings?.auto_save_enabled]
  )

  const { status } = useAutoSave({
    data: form,
    onSave: handleSave,
    enabled: Boolean(form && appSettings?.auto_save_enabled),
    ready: Boolean(form?.id),
    localStorageKey: 'vh-invoice-settings-draft',
  })

  function updateField<K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) {
    if (!form) return
    setForm({ ...form, [key]: value })
  }

  async function handleManualSave() {
    if (!form?.id) return
    setManualSaving(true)
    setError(null)
    try {
      const saved = await saveInvoiceSettings(form)
      setForm(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setManualSaving(false)
    }
  }

  async function handleAssetUpload(kind: AssetKind, file: File) {
    if (!form) return
    setUploading(kind)
    setError(null)
    try {
      const path = await uploadInvoiceAsset(kind, file)
      const key =
        kind === 'logo' ? 'logo_path' : kind === 'signature' ? 'signature_path' : 'stamp_path'
      const next = { ...form, [key]: path }
      setForm(next)
      await saveInvoiceSettings(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nahrání souboru se nezdařilo')
    } finally {
      setUploading(null)
    }
  }

  if (loading || !form) {
    return (
      <AppLayout title="Nastavení faktur">
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Nastavení faktur">
      <PageHeader
        title="Nastavení faktur"
        description="Firemní údaje, logo, podpis a razítko pro modul Fakturovač. Vyplňte jednou – použije se na každé faktuře."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/fakturace" className="btn-neon inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium">
              <ArrowLeft className="h-4 w-4" />
              Fakturovač
            </Link>
            <Button onClick={handleManualSave} disabled={manualSaving}>
              <Save className="h-4 w-4" />
              Uložit
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <AutoSaveIndicator status={status} />
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

      <Card className="mb-6">
        <h3 className="mb-4 text-lg font-semibold text-theme-primary">Firemní údaje dodavatele</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Název firmy" value={form.company_name} onChange={(e) => updateField('company_name', e.target.value)} />
          <Input label="IČO" value={form.ico} onChange={(e) => updateField('ico', e.target.value)} />
          <Input label="DIČ" value={form.dic} onChange={(e) => updateField('dic', e.target.value)} />
          <Input label="Telefon" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
          <Input label="Web" value={form.website} onChange={(e) => updateField('website', e.target.value)} />
          <Input label="Adresa" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
          <Input label="Město" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
          <Input label="PSČ" value={form.postal_code} onChange={(e) => updateField('postal_code', e.target.value)} />
          <Input label="Číslo účtu" value={form.bank_account} onChange={(e) => updateField('bank_account', e.target.value)} />
          <Input label="Banka" value={form.bank_name} onChange={(e) => updateField('bank_name', e.target.value)} />
          <Input
            label="Výchozí splatnost (dny)"
            type="number"
            min={0}
            value={form.default_due_days}
            onChange={(e) => updateField('default_due_days', Number(e.target.value) || 0)}
          />
          <Select
            label="Plátce DPH"
            options={[
              { value: 'true', label: 'ANO' },
              { value: 'false', label: 'NE' },
            ]}
            value={String(form.is_vat_payer)}
            onChange={(e) => updateField('is_vat_payer', e.target.value === 'true')}
          />
          <Input
            label="Výchozí sazba DPH (%)"
            type="number"
            min={0}
            step="0.01"
            value={form.default_vat_rate}
            onChange={(e) => updateField('default_vat_rate', Number(e.target.value) || 0)}
          />
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {(['logo', 'signature', 'stamp'] as AssetKind[]).map((kind) => {
          const label = kind === 'logo' ? 'Firemní logo' : kind === 'signature' ? 'Podpis' : 'Razítko'
          const path = kind === 'logo' ? form.logo_path : kind === 'signature' ? form.signature_path : form.stamp_path
          const url = getInvoiceAssetUrl(path)
          return (
            <Card key={kind}>
              <h3 className="mb-3 font-semibold text-theme-primary">{label}</h3>
              {url ? (
                <img src={url} alt={label} className="mb-3 max-h-32 w-full rounded-xl object-contain" />
              ) : (
                <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--border-glass)] text-sm text-theme-muted">
                  Zatím nenahráno
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-accent">
                <Upload className="h-4 w-4" />
                {uploading === kind ? 'Nahrávám…' : 'Nahrát z galerie'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleAssetUpload(kind, file)
                    e.currentTarget.value = ''
                  }}
                />
              </label>
            </Card>
          )
        })}
      </div>
    </AppLayout>
  )
}

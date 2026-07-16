import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Save, Upload, Droplets } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { useAppSettings } from '@/context/AppSettingsContext'
import { useAutoSave } from '@/hooks/useAutoSave'
import { uploadCompanyLogo } from '@/lib/company/api'
import type { CompanySettings } from '@/types'

export function CompanySettingsPage() {
  const { settings, loading, updateSettings, saveSettings } = useCompanySettings()
  const { settings: appSettings } = useAppSettings()
  const [form, setForm] = useState<CompanySettings | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoSuccess, setLogoSuccess] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const handleSave = useCallback(
    async (data: CompanySettings) => {
      if (!appSettings?.auto_save_enabled) return
      await saveSettings(data)
    },
    [saveSettings, appSettings?.auto_save_enabled]
  )

  const { status } = useAutoSave({
    data: form,
    onSave: handleSave,
    enabled: Boolean(form && appSettings?.auto_save_enabled),
    ready: Boolean(form),
    localStorageKey: 'vh-company-settings-draft',
  })

  function updateField<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    if (!form) return
    setForm({ ...form, [key]: value })
    updateSettings({ [key]: value })
  }

  async function handleManualSave() {
    if (!form) return
    setManualSaving(true)
    try {
      await saveSettings(form)
    } finally {
      setManualSaving(false)
    }
  }

  async function handleLogoUpload(file: File) {
    if (!form) return
    setLogoError(null)
    setLogoSuccess(false)
    setLogoUploading(true)
    try {
      const url = await uploadCompanyLogo(form.id, file)
      const next = { ...form, logo_url: url }
      setForm(next)
      updateSettings({ logo_url: url })
      await saveSettings(next)
      setLogoSuccess(true)
      setTimeout(() => setLogoSuccess(false), 3500)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Nahrání loga se nezdařilo')
    } finally {
      setLogoUploading(false)
    }
  }

  if (loading || !form) {
    return (
      <AppLayout title="Nastavení společnosti">
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title="Nastavení společnosti"
      headerAction={
        <div className="flex items-center gap-2">
          <AutoSaveIndicator status={status} />
          {!appSettings?.auto_save_enabled && (
            <Button type="button" size="sm" loading={manualSaving} onClick={handleManualSave}>
              <Save className="h-4 w-4" />
              Uložit
            </Button>
          )}
        </div>
      }
    >
      <PageHeader
        title="Nastavení společnosti"
        description="Firemní údaje VH Bulldig s.r.o. Logo nahrávejte zde – vodoznak PDF nastavíte v sekci Vodoznak PDF."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-base font-semibold text-theme-primary">Logo společnosti</h3>
          <p className="mb-4 text-sm text-theme-muted">
            Logo nahrávejte pouze zde jako PNG s průhledným pozadím (cca 300–600 px na šířku). Použije se ve
            smlouvách, výplatních páskách, deníku, fakturaci a všech ostatních dokumentech.
          </p>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo VH Bulldig" className="max-h-20 rounded-lg neon-border bg-white/5 p-2" />
            ) : (
              <div className="flex h-20 w-40 items-center justify-center rounded-lg neon-border bg-white/5 text-xs text-theme-muted">
                Logo není nahráno
              </div>
            )}
            <label className="cursor-pointer">
              <span className="btn-neon inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm">
                <Upload className="h-4 w-4" />
                {logoUploading ? 'Nahrávám…' : 'Nahrát logo'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                disabled={logoUploading}
                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              />
            </label>
          </div>
          {logoSuccess && <p className="mt-3 text-xs font-medium text-green-400">Logo bylo úspěšně nahráno.</p>}
          {logoError && <p className="mt-3 text-xs text-red-400">{logoError}</p>}
        </Card>

        <Card>
          <div className="flex items-start gap-4">
            <div className="rounded-xl p-3 nav-item-active">
              <Droplets className="h-6 w-6 text-[var(--accent-primary)]" />
            </div>
            <div className="flex-1">
              <h3 className="mb-2 text-base font-semibold text-theme-primary">Vodoznak PDF</h3>
              <p className="mb-4 text-sm text-theme-muted">
                Vodoznak pro všechna PDF exporty nastavíte v samostatné sekci – nahrání obrázku, průhlednost,
                velikost, rozostření a živý náhled.
              </p>
              <Link
                to="/nastaveni/vodoznak-pdf"
                className="btn-neon inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm"
              >
                Otevřít Vodoznak PDF
              </Link>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-semibold text-theme-primary">Základní údaje</h3>
          <div className="space-y-4">
            <Input
              label="Název společnosti"
              value={form.company_name}
              onChange={(e) => updateField('company_name', e.target.value)}
            />
            <Input
              label="Slogan / popis firmy"
              value={form.tagline}
              onChange={(e) => updateField('tagline', e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="IČO" value={form.ico} onChange={(e) => updateField('ico', e.target.value)} />
              <Input label="DIČ" value={form.dic} onChange={(e) => updateField('dic', e.target.value)} />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-semibold text-theme-primary">Kontaktní údaje</h3>
          <div className="space-y-4">
            <Input label="Telefon" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
            <Input label="Web" value={form.website} onChange={(e) => updateField('website', e.target.value)} />
            <Input
              label="Bankovní účet"
              value={form.bank_account}
              onChange={(e) => updateField('bank_account', e.target.value)}
            />
            <Input
              label="Jednatel společnosti"
              value={form.director_name ?? ''}
              onChange={(e) => updateField('director_name', e.target.value)}
            />
            <Input
              label="E-mail účetní"
              type="email"
              value={form.accountant_email ?? ''}
              onChange={(e) => updateField('accountant_email', e.target.value)}
              hint="Použije se pro odesílání paragonů k zaúčtování"
            />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-base font-semibold text-theme-primary">Adresa</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Input
                label="Ulice a číslo"
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
              />
            </div>
            <Input label="Město" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
            <Input
              label="PSČ"
              value={form.postal_code}
              onChange={(e) => updateField('postal_code', e.target.value)}
            />
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}

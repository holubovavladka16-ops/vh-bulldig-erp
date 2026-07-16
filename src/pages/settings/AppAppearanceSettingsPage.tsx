import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DesignPreviewCard } from '@/components/settings/DesignPreviewCard'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { useTheme } from '@/context/ThemeContext'
import { isAdministrator } from '@/constants/permissions'
import { APP_DESIGN_OPTIONS, getAppDesignLabel, normalizeAppDesign } from '@/constants/appDesign'
import { clearStoredDeviceDesign } from '@/lib/company/deviceDesign'
import type { AppDesign } from '@/types'

export function AppAppearanceSettingsPage() {
  const { profile } = useAuth()
  const { settings, loading, saveCompanyDefaultAppDesign } = useCompanySettings()
  const { appDesign, hasDeviceDesignOverride, setAppDesign, refreshDeviceDesignFlag } = useTheme()
  const [pendingDesign, setPendingDesign] = useState<AppDesign | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isAdmin = profile ? isAdministrator(profile.role) : false
  const companyDefault = normalizeAppDesign(settings?.app_design ?? 'design_1')

  function handleUseOnDevice() {
    if (!pendingDesign) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const label = getAppDesignLabel(pendingDesign)
      setAppDesign(pendingDesign)
      setPendingDesign(null)
      setSuccess(`${label} je aktivní na tomto zařízení.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení vzhledu se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetCompanyDefault() {
    if (!pendingDesign || !isAdmin) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await saveCompanyDefaultAppDesign(pendingDesign)
      setPendingDesign(null)
      setSuccess(
        `${getAppDesignLabel(pendingDesign)} je nyní firemní výchozí pro nová zařízení.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení firemního výchozího se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  function handleUseCompanyDefault() {
    setError('')
    setSuccess('')
    clearStoredDeviceDesign()
    refreshDeviceDesignFlag()
    setAppDesign(companyDefault, { persistDevice: false })
    setSuccess(`Používá se firemní výchozí: ${getAppDesignLabel(companyDefault)}.`)
  }

  if (loading || !settings) {
    return (
      <AppLayout title="Vzhled aplikace">
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Vzhled aplikace">
      <PageHeader
        title="Vzhled aplikace"
        description="Každé zařízení si pamatuje vlastní design lokálně. Změna na telefonu neovlivní počítač ani tablet."
      />

      <div className="mx-auto mb-6 max-w-7xl rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-glass)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm">
            <p className="text-theme-secondary">
              Design tohoto zařízení:{' '}
              <strong className="text-theme-primary">{getAppDesignLabel(appDesign)}</strong>
            </p>
            <p className="text-theme-secondary">
              Firemní výchozí:{' '}
              <strong className="text-theme-primary">{getAppDesignLabel(companyDefault)}</strong>
            </p>
            <p className="text-xs text-theme-muted">
              {hasDeviceDesignOverride
                ? 'Aktivní je lokální volba tohoto zařízení (localStorage).'
                : 'Používá se firemní výchozí z databáze — lokální volba není nastavena.'}
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={handleUseCompanyDefault}
            disabled={!hasDeviceDesignOverride && appDesign === companyDefault}
          >
            Použít firemní výchozí
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {APP_DESIGN_OPTIONS.map((option) => (
          <DesignPreviewCard
            key={option.id}
            design={option.id}
            active={appDesign === option.id}
            onSelect={() => {
              if (appDesign !== option.id) {
                setPendingDesign(option.id)
                setSuccess('')
                setError('')
              }
            }}
          />
        ))}
      </div>

      {error && <p className="mx-auto mt-4 max-w-5xl text-sm text-red-400">{error}</p>}
      {success && <p className="mx-auto mt-4 max-w-5xl text-sm text-emerald-400">{success}</p>}

      {pendingDesign && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="design-confirm-title">
          <div className="modal-backdrop" onClick={() => !saving && setPendingDesign(null)} />
          <div className="modal-panel modal-panel-md glass-panel neon-border">
            <h2 id="design-confirm-title" className="text-lg font-semibold text-theme-primary">
              Změna vzhledu na tomto zařízení
            </h2>
            <p className="mt-3 text-sm text-theme-secondary">
              Chcete použít{' '}
              <strong className="text-theme-primary">{getAppDesignLabel(pendingDesign)}</strong>{' '}
              pouze na tomto zařízení?
            </p>
            <p className="mt-2 text-xs text-theme-muted">
              Volba se uloží lokálně do prohlížeče a nezmění vzhled na jiných zařízeních.
            </p>

            <div className="modal-footer flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button variant="secondary" onClick={() => setPendingDesign(null)} disabled={saving}>
                Zrušit
              </Button>
              <Button onClick={handleUseOnDevice} loading={saving}>
                Použít na tomto zařízení
              </Button>
              {isAdmin && (
                <Button variant="secondary" onClick={handleSetCompanyDefault} loading={saving}>
                  Nastavit jako firemní výchozí
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

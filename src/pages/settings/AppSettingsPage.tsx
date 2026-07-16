import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Toggle } from '@/components/ui/Toggle'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import { useAppSettings } from '@/context/AppSettingsContext'
import { useTheme } from '@/context/ThemeContext'
import { useAutoSave } from '@/hooks/useAutoSave'
import type { AppSettings } from '@/types'

export function AppSettingsPage() {
  const { settings, updateSettings, saveSettings } = useAppSettings()
  const { setTheme } = useTheme()
  const [form, setForm] = useState<AppSettings | null>(null)

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const handleSave = useCallback(
    async (data: AppSettings) => {
      await saveSettings(data)
    },
    [saveSettings]
  )

  const { status } = useAutoSave({
    data: form,
    onSave: handleSave,
    enabled: Boolean(form),
    localStorageKey: 'vh-app-settings-draft',
  })

  function updateField<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    if (!form) return
    const updated = { ...form, [key]: value }
    setForm(updated)
    updateSettings({ [key]: value })

    if (key === 'theme') {
      setTheme(value as AppSettings['theme'])
    }
  }

  if (!form) {
    return (
      <AppLayout title="Nastavení aplikace">
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Nastavení aplikace" headerAction={<AutoSaveIndicator status={status} />}>
      <PageHeader
        title="Nastavení aplikace"
        description="Vzhled, chování a preference – automatické ukládání."
      />

      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <h3 className="mb-4 text-base font-semibold text-theme-primary">Vzhled</h3>
          <div className="space-y-1">
            <Toggle
              label="Tmavý režim"
              description="Přepnout mezi tmavým a světlým režimem aplikace"
              checked={form.theme === 'dark'}
              onChange={(checked) => updateField('theme', checked ? 'dark' : 'light')}
            />
            <Toggle
              label="Kompaktní režim"
              description="Zmenšené rozestupy pro větší množství informací na obrazovce"
              checked={form.compact_mode}
              onChange={(checked) => updateField('compact_mode', checked)}
            />
            <Toggle
              label="Sbalené postranní menu"
              description="Výchozí stav postranního menu po přihlášení"
              checked={form.sidebar_collapsed}
              onChange={(checked) => updateField('sidebar_collapsed', checked)}
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-semibold text-theme-primary">Chování systému</h3>
          <div className="space-y-1">
            <Toggle
              label="Automatické ukládání"
              description="Změny ve formulářích se ukládají automaticky po zadání"
              checked={form.auto_save_enabled}
              onChange={(checked) => updateField('auto_save_enabled', checked)}
            />
            <Toggle
              label="Oznámení"
              description="Zobrazovat systémová oznámení v horní liště"
              checked={form.notifications_enabled}
              onChange={(checked) => updateField('notifications_enabled', checked)}
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-semibold text-theme-primary">Lokalizace</h3>
          <p className="text-sm text-theme-secondary">
            Jazyk aplikace: <strong className="text-theme-primary">Čeština (cs)</strong>
          </p>
          <p className="mt-1 text-xs text-theme-muted">
            Aplikace je kompletně lokalizována do češtiny dle specifikace Modulu 1.
          </p>
        </Card>
      </div>
    </AppLayout>
  )
}

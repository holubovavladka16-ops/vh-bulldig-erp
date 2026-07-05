import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import { RoleBadge } from '@/components/ui/Badge'
import { AccountSecurityCard } from '@/components/settings/AccountSecurityCard'
import { useAuth } from '@/context/AuthContext'
import { useAppSettings } from '@/context/AppSettingsContext'
import { useAutoSave } from '@/hooks/useAutoSave'
import { supabase } from '@/lib/supabase'
import type { ProfileForm } from '@/types'

export function ProfileSettingsPage() {
  const { profile, refreshProfile } = useAuth()
  const { settings: appSettings } = useAppSettings()
  const [form, setForm] = useState<ProfileForm | null>(null)

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        phone: profile.phone ?? '',
        email: profile.email,
      })
    }
  }, [profile])

  const handleSave = useCallback(
    async (data: ProfileForm) => {
      if (!profile || !appSettings?.auto_save_enabled) return

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: data.full_name, phone: data.phone || null })
        .eq('id', profile.id)

      if (error) throw new Error(error.message)
      await refreshProfile()
    },
    [profile, appSettings?.auto_save_enabled, refreshProfile]
  )

  const { status } = useAutoSave({
    data: form,
    onSave: handleSave,
    enabled: Boolean(form && profile && appSettings?.auto_save_enabled),
    ready: Boolean(form),
    localStorageKey: 'vh-profile-draft',
  })

  if (!profile || !form) {
    return (
      <AppLayout title="Profil administrátora">
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Profil administrátora" headerAction={<AutoSaveIndicator status={status} />}>
      <PageHeader
        title="Profil administrátora"
        description="Osobní údaje a kontaktní informace – automatické ukládání."
      />

      <div className="mx-auto max-w-2xl">
        <Card>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl nav-item-active text-2xl font-bold text-accent">
              {form.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-theme-primary">{form.full_name}</p>
              <RoleBadge role={profile.role} />
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Celé jméno"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            <Input label="E-mail" value={form.email} disabled hint="E-mail lze změnit v sekci Přihlašovací údaje níže" />
            <Input
              label="Telefon"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+420 ..."
            />
          </div>
        </Card>

        <AccountSecurityCard />
      </div>
    </AppLayout>
  )
}

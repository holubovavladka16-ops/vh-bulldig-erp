import { useEffect, useState, useCallback } from 'react'

import { Mail, UserPlus, UserMinus, ShieldOff } from 'lucide-react'

import { AppLayout } from '@/components/layout/AppLayout'

import { PageHeader } from '@/components/ui/PageHeader'

import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'

import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'

import { Select } from '@/components/ui/Select'

import { Button } from '@/components/ui/Button'

import { RoleBadge } from '@/components/ui/Badge'

import { AdminInviteModal } from '@/components/settings/AdminInviteModal'

import { useAppSettings } from '@/context/AppSettingsContext'

import { useAuth } from '@/context/AuthContext'

import { useAutoSave } from '@/hooks/useAutoSave'

import { supabase } from '@/lib/supabase'

import {

  adminRevokeAdministrator,

  adminSetUserActive,

  buildAccessShareEmailUrl,

} from '@/lib/auth/admin'

import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/constants/permissions'

import type { Profile, UserRole } from '@/types'



export function PermissionsSettingsPage() {

  const { profile: currentProfile } = useAuth()

  const { settings: appSettings } = useAppSettings()

  const [users, setUsers] = useState<Profile[]>([])

  const [loading, setLoading] = useState(true)

  const [initialized, setInitialized] = useState(false)

  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({})

  const [inviteOpen, setInviteOpen] = useState(false)

  const [actionError, setActionError] = useState('')



  const loadUsers = useCallback(async () => {

    setLoading(true)

    const { data, error } = await supabase.from('profiles').select('*').order('full_name')



    if (!error && data) {

      setUsers(data as Profile[])

      const roles: Record<string, UserRole> = {}

      for (const user of data as Profile[]) {

        roles[user.id] = user.role

      }

      setPendingRoles(roles)

      setInitialized(true)

    }

    setLoading(false)

  }, [])



  useEffect(() => {

    loadUsers()

  }, [loadUsers])



  const handleSave = useCallback(

    async (roles: Record<string, UserRole>) => {

      if (!appSettings?.auto_save_enabled) return



      for (const [userId, role] of Object.entries(roles)) {

        const original = users.find((u) => u.id === userId)

        if (original && original.role !== role) {

          const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)

          if (error) throw new Error(error.message)

        }

      }



      await loadUsers()

    },

    [users, appSettings?.auto_save_enabled, loadUsers]

  )



  const { status } = useAutoSave({

    data: pendingRoles,

    onSave: handleSave,

    enabled: Boolean(appSettings?.auto_save_enabled),

    ready: initialized,

    delay: 1500,

  })



  function updateRole(userId: string, role: UserRole) {

    setPendingRoles((prev) => ({ ...prev, [userId]: role }))

  }



  async function handleDeactivate(user: Profile) {

    setActionError('')

    try {

      await adminSetUserActive(user.id, false)

      await loadUsers()

    } catch (err) {

      setActionError(err instanceof Error ? err.message : 'Deaktivace se nezdařila.')

    }

  }



  async function handleActivate(user: Profile) {

    setActionError('')

    try {

      await adminSetUserActive(user.id, true)

      await loadUsers()

    } catch (err) {

      setActionError(err instanceof Error ? err.message : 'Aktivace se nezdařila.')

    }

  }



  async function handleRevokeAdmin(user: Profile) {

    setActionError('')

    try {

      await adminRevokeAdministrator(user.id)

      await loadUsers()

    } catch (err) {

      setActionError(err instanceof Error ? err.message : 'Odebrání administrátora se nezdařilo.')

    }

  }



  function shareAccess(user: Profile) {

    const loginUrl = `${window.location.origin}/prihlaseni`

    window.location.href = buildAccessShareEmailUrl({

      recipientEmail: user.email,

      loginUrl,

      invitedEmail: user.email,

    })

  }



  const roleOptions = (Object.keys(ROLE_LABELS) as UserRole[]).map((role) => ({

    value: role,

    label: ROLE_LABELS[role],

  }))



  return (

    <AppLayout title="Role uživatelů" headerAction={<AutoSaveIndicator status={status} />}>

      <PageHeader

        title="Správa uživatelů a rolí"

        description="Přidávání administrátorů, odebírání přístupu a sdílení přihlášení e-mailem."

        action={

          <Button onClick={() => setInviteOpen(true)}>

            <UserPlus className="h-4 w-4" />

            Přidat uživatele

          </Button>

        }

      />



      <div className="mb-6 grid gap-4 sm:grid-cols-3">

        {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (

          <div key={role} className="glass-panel neon-border rounded-xl p-4">

            <RoleBadge role={role} />

            <p className="mt-2 text-xs text-theme-muted">{ROLE_DESCRIPTIONS[role]}</p>

          </div>

        ))}

      </div>



      {actionError && (

        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">

          {actionError}

        </div>

      )}



      {loading ? (

        <div className="flex items-center justify-center py-20">

          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />

        </div>

      ) : (

        <DataTable

          columns={[

            { key: 'name', label: 'Uživatel' },

            { key: 'email', label: 'E-mail' },

            { key: 'role', label: 'Role v systému' },

            { key: 'status', label: 'Stav' },

            { key: 'actions', label: 'Akce', className: 'text-right' },

          ]}

          isEmpty={users.length === 0}

          emptyMessage="V systému nejsou registrováni žádní uživatelé."

        >

          {users.map((user) => {

            const isSelf = user.id === currentProfile?.id

            return (

              <DataTableRow key={user.id}>

                <DataTableCell>

                  <span className="font-medium">{user.full_name}</span>

                  {isSelf && <span className="ml-2 text-xs text-theme-muted">(vy)</span>}

                </DataTableCell>

                <DataTableCell>{user.email}</DataTableCell>

                <DataTableCell>

                  <Select

                    options={roleOptions}

                    value={pendingRoles[user.id] ?? user.role}

                    onChange={(e) => updateRole(user.id, e.target.value as UserRole)}

                    aria-label={`Role uživatele ${user.full_name}`}

                    disabled={!user.is_active}

                  />

                </DataTableCell>

                <DataTableCell>

                  {user.is_active ? (

                    <span className="text-green-400">Aktivní</span>

                  ) : (

                    <span className="text-red-400">Neaktivní</span>

                  )}

                </DataTableCell>

                <DataTableCell>

                  <div className="flex flex-wrap justify-end gap-2">

                    <Button variant="ghost" size="sm" onClick={() => shareAccess(user)} title="Sdílet přístup e-mailem">

                      <Mail className="h-4 w-4" />

                    </Button>

                    {user.is_active ? (

                      <Button

                        variant="ghost"

                        size="sm"

                        onClick={() => handleDeactivate(user)}

                        disabled={isSelf}

                        title="Deaktivovat účet"

                      >

                        <UserMinus className="h-4 w-4" />

                      </Button>

                    ) : (

                      <Button variant="ghost" size="sm" onClick={() => handleActivate(user)} title="Aktivovat účet">

                        <UserPlus className="h-4 w-4" />

                      </Button>

                    )}

                    {user.role === 'administrator' && !isSelf && user.is_active && (

                      <Button

                        variant="ghost"

                        size="sm"

                        onClick={() => handleRevokeAdmin(user)}

                        title="Odebrat administrátora"

                      >

                        <ShieldOff className="h-4 w-4" />

                      </Button>

                    )}

                  </div>

                </DataTableCell>

              </DataTableRow>

            )

          })}

        </DataTable>

      )}



      <AdminInviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onCreated={loadUsers} />

    </AppLayout>

  )

}


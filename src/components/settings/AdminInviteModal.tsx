import { useState, type FormEvent } from 'react'
import { X, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { adminCreateUser, buildAccessShareEmailUrl } from '@/lib/auth/admin'
import { getPublicAppUrl } from '@/lib/env'
import { ROLE_LABELS } from '@/constants/permissions'
import type { UserRole } from '@/types'

interface AdminInviteModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function AdminInviteModal({ open, onClose, onCreated }: AdminInviteModalProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('administrator')
  const [shareByEmail, setShareByEmail] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await adminCreateUser({ email, password, fullName, role })

      if (shareByEmail) {
        const loginUrl = `${getPublicAppUrl()}/prihlaseni`
        window.location.href = buildAccessShareEmailUrl({
          recipientEmail: email,
          loginUrl,
          invitedEmail: email,
          temporaryPassword: password,
        })
      }

      onCreated()
      onClose()
      setFullName('')
      setEmail('')
      setPassword('')
      setRole('administrator')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření uživatele se nezdařilo.')
    } finally {
      setLoading(false)
    }
  }

  const roleOptions = (Object.keys(ROLE_LABELS) as UserRole[]).map((value) => ({
    value,
    label: ROLE_LABELS[value],
  }))

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-md glass-panel neon-border scrollbar-premium">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">Přidat uživatele</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Celé jméno" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="Dočasné heslo"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimálně 8 znaků"
            required
          />
          <Select label="Role" options={roleOptions} value={role} onChange={(e) => setRole(e.target.value as UserRole)} />

          <label className="flex items-center gap-2 text-sm text-theme-secondary">
            <input
              type="checkbox"
              checked={shareByEmail}
              onChange={(e) => setShareByEmail(e.target.checked)}
              className="rounded border-[var(--border-glass)]"
            />
            <Mail className="h-4 w-4" />
            Po vytvoření otevřít e-mail se sdílením přístupu
          </label>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Zrušit
            </Button>
            <Button type="submit" loading={loading}>
              Vytvořit uživatele
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

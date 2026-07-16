import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { updateAuthEmail, updateAuthPassword } from '@/lib/auth/admin'
import { useAuth } from '@/context/AuthContext'

export function AccountSecurityCard() {
  const { profile, refreshProfile } = useAuth()
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  if (!profile) return null

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setEmailError('')
    setEmailMessage('')
    setEmailLoading(true)

    try {
      await updateAuthEmail(newEmail)
      setEmailMessage('Požadavek na změnu e-mailu byl odeslán. Pokud je vyžadováno potvrzení, zkontrolujte schránku.')
      await refreshProfile()
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Změna e-mailu se nezdařila.')
    } finally {
      setEmailLoading(false)
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (newPassword.length < 8) {
      setPasswordError('Heslo musí mít alespoň 8 znaků.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Hesla se neshodují.')
      return
    }

    setPasswordLoading(true)
    try {
      await updateAuthPassword(newPassword)
      setPasswordMessage('Heslo bylo úspěšně změněno.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Změna hesla se nezdařila.')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <Card className="mt-6">
      <h3 className="mb-2 text-lg font-semibold text-theme-primary">Přihlašovací údaje</h3>
      <p className="mb-6 text-sm text-theme-secondary">
        Heslo je bezpečně uloženo šifrované v databázi. Zde můžete změnit e-mail a heslo.
      </p>

      <form onSubmit={handleEmailSubmit} className="space-y-4 border-b border-[var(--border-glass)] pb-6">
        <Input label="Aktuální e-mail" value={profile.email} disabled />
        <Input
          label="Nový e-mail"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="nový@email.cz"
          required
        />
        {emailError && <p className="text-sm text-red-400">{emailError}</p>}
        {emailMessage && <p className="text-sm text-green-400">{emailMessage}</p>}
        <Button type="submit" variant="secondary" loading={emailLoading}>
          Změnit e-mail
        </Button>
      </form>

      <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
        <div className="relative">
          <Input
            label="Nové heslo"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimálně 8 znaků"
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[38px] text-theme-muted hover:text-theme-primary"
            aria-label={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Input
          label="Potvrzení nového hesla"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
        {passwordMessage && <p className="text-sm text-green-400">{passwordMessage}</p>}
        <Button type="submit" variant="secondary" loading={passwordLoading}>
          Změnit heslo
        </Button>
      </form>
    </Card>
  )
}

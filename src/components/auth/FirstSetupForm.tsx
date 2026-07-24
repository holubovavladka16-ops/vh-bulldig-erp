import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { bootstrapFirstAdmin, getInitialAdminEmailHint } from '@/lib/auth/admin'
import { useAuth } from '@/context/AuthContext'

interface FirstSetupFormProps {
  onComplete: () => void
}

export function FirstSetupForm({ onComplete }: FirstSetupFormProps) {
  const { signIn } = useAuth()
  const [fullName, setFullName] = useState('Administrátor')
  const [email, setEmail] = useState(getInitialAdminEmailHint())
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Heslo musí mít alespoň 8 znaků.')
      return
    }

    if (password !== confirmPassword) {
      setError('Hesla se neshodují.')
      return
    }

    setLoading(true)
    try {
      await bootstrapFirstAdmin(email, password, fullName)
      const result = await signIn(email, password)
      if (result.error) {
        setError(result.error)
        return
      }
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření administrátora se nezdařilo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--accent-primary)]">
          <Shield className="h-3.5 w-3.5" />
          První spuštění systému
        </div>
        <h1 className="text-2xl font-bold text-theme-primary">Vytvoření administrátora</h1>
        <p className="mt-2 text-theme-secondary">
          Systém zatím nemá administrátorský účet. Vytvořte hlavní přístup – heslo se uloží bezpečně
          šifrované v databázi.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Celé jméno"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
        />
        <Input
          label="E-mail administrátora"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@firma.cz"
          required
          autoComplete="email"
        />

        <div className="relative">
          <Input
            label="Heslo"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          label="Potvrzení hesla"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Vytvořit administrátora a přihlásit
        </Button>
      </form>
    </div>
  )
}

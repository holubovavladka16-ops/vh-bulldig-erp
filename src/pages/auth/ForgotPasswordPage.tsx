import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { HardHat } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { APP_INFO } from '@/constants/navigation'

export function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const result = await resetPasswordForEmail(email)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setMessage(
      'Pokud účet existuje, odeslali jsme e-mail s odkazem pro obnovu hesla. Zkontrolujte schránku včetně spamu.'
    )
  }

  return (
    <div className="app-background flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="glass-panel neon-border w-full max-w-md rounded-2xl p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl nav-item-active">
            <HardHat className="h-5 w-5 icon-neon" />
          </div>
          <div>
            <p className="font-bold text-theme-primary">{APP_INFO.shortName}</p>
            <p className="text-xs text-theme-muted">Obnova hesla</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-theme-primary">Zapomenuté heslo</h1>
        <p className="mt-2 text-sm text-theme-secondary">
          Zadejte e-mail administrátora. Pošleme odkaz pro nastavení nového hesla.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {message}
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full">
            Odeslat odkaz
          </Button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link to="/prihlaseni" className="text-accent hover:underline">
            Zpět na přihlášení
          </Link>
        </p>
      </div>
    </div>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { HardHat, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { translateAuthError } from '@/lib/auth/errors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { APP_INFO } from '@/constants/navigation'

export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(Boolean(session))
    })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Heslo musí mít alespoň 8 znaků.')
      return
    }
    if (password !== confirm) {
      setError('Hesla se neshodují.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(translateAuthError(updateError.message))
      return
    }

    setDone(true)
    await supabase.auth.signOut()
  }

  if (done) {
    return <Navigate to="/prihlaseni" replace />
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
            <p className="text-xs text-theme-muted">Nové heslo</p>
          </div>
        </div>

        {!ready ? (
          <>
            <h1 className="text-xl font-bold text-theme-primary">Neplatný nebo expirovaný odkaz</h1>
            <p className="mt-2 text-sm text-theme-secondary">
              Otevřete odkaz z e-mailu znovu, nebo požádejte o nový na stránce obnovy hesla.
            </p>
            <Link to="/zapomenute-heslo" className="mt-6 inline-block text-accent hover:underline">
              Požádat o nový odkaz
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-theme-primary">Nastavit nové heslo</h1>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="relative">
                <Input
                  label="Nové heslo"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="touch-target absolute bottom-2 right-2 rounded-lg p-2 text-theme-muted"
                  aria-label={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Input
                label="Potvrzení hesla"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <Button type="submit" loading={loading} className="w-full">
                Uložit heslo
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

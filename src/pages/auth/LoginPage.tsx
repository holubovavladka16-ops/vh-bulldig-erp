import { useEffect, useState, type FormEvent } from 'react'

import { Navigate } from 'react-router-dom'

import { HardHat, Eye, EyeOff, Shield } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'
import { canAccessErp } from '@/constants/permissions'

import { useTheme } from '@/context/ThemeContext'

import { Button } from '@/components/ui/Button'

import { Input } from '@/components/ui/Input'

import { FirstSetupForm } from '@/components/auth/FirstSetupForm'
import { MigrationSetupNotice } from '@/components/auth/MigrationSetupNotice'
import { SupabaseConfigNotice } from '@/components/auth/SupabaseConfigNotice'

import { checkSystemNeedsBootstrap, isSupabaseConfigured } from '@/lib/auth/admin'

import { APP_INFO } from '@/constants/navigation'



export function LoginPage() {

  const { user, profile, signIn, signOut, loading: authLoading } = useAuth()

  const { theme, toggleTheme } = useTheme()

  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null)
  const [migrationSetupRequired, setMigrationSetupRequired] = useState(false)
  const [bootstrapError, setBootstrapError] = useState('')

  const supabaseConfigured = isSupabaseConfigured()

  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState('')

  const [loading, setLoading] = useState(false)



  useEffect(() => {
    if (!supabaseConfigured) {
      setNeedsBootstrap(false)
      return
    }

    checkSystemNeedsBootstrap()
      .then(setNeedsBootstrap)
      .catch((err) => {
        const message =
          err instanceof Error
            ? err.message
            : 'Nepodařilo se ověřit stav administrátora. Zkontrolujte Supabase a migrace.'
        if (message.includes('migrace') || message.includes('system_needs_bootstrap')) {
          setMigrationSetupRequired(true)
        }
        setNeedsBootstrap(false)
        setBootstrapError(message)
      })
  }, [supabaseConfigured])



  if (authLoading || needsBootstrap === null) {

    return (

      <div className="app-background flex min-h-dvh items-center justify-center">

        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />

      </div>

    )

  }



  if (user && profile && canAccessErp(profile.role)) {
    return <Navigate to="/" replace />
  }

  if (user && profile && !canAccessErp(profile.role)) {
    return (
      <div className="app-background flex min-h-dvh items-center justify-center p-6">
        <div className="glass-panel neon-border max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-theme-primary">Přístup odepřen</h1>
          <p className="mt-2 text-sm text-theme-secondary">
            Tento účet nemá oprávnění do ERP. Zaměstnanci používají pouze osobní odkaz od administrátora.
          </p>
          <Button className="mt-6" onClick={() => signOut()}>
            Zpět na přihlášení
          </Button>
        </div>
      </div>
    )
  }



  async function handleSubmit(e: FormEvent) {

    e.preventDefault()

    setError('')

    setLoading(true)



    const result = await signIn(email, password)

    if (result.error) setError(result.error)

    setLoading(false)

  }



  return (

    <div className="app-background flex min-h-dvh">

      <div className="hidden w-1/2 flex-col justify-between p-12 lg:flex">

        <div className="flex items-center gap-4">

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl nav-item-active">

            <HardHat className="h-8 w-8 icon-neon" />

          </div>

          <div>

            <p className="text-xl font-bold text-theme-primary">{APP_INFO.companyName}</p>

            <p className="text-sm text-theme-muted">{APP_INFO.tagline}</p>

          </div>

        </div>



        <div>

          <p className="mb-3 text-sm font-medium text-accent">{APP_INFO.moduleLabel}</p>

          <h2 className="text-4xl font-bold leading-tight text-theme-primary">

            Podnikový ERP systém

          </h2>

          <p className="mt-4 max-w-lg text-lg text-theme-secondary">

            Profesionální platforma pro správu dělníků, docházky, zakázek, ekonomiky

            a firemních procesů VH Bulldig s.r.o.

          </p>



          <div className="mt-10 grid grid-cols-2 gap-4">

            {[

              { label: 'Dělníci', desc: 'Správa pracovníků' },

              { label: 'Docházka', desc: 'Evidence práce' },

              { label: 'Zakázky', desc: 'Řízení projektů' },

              { label: 'Ekonomika', desc: 'Finanční přehled' },

            ].map((item) => (

              <div key={item.label} className="glass-panel neon-border rounded-2xl p-4">

                <p className="text-sm font-semibold text-accent">{item.label}</p>

                <p className="mt-1 text-sm text-theme-muted">{item.desc}</p>

              </div>

            ))}

          </div>

        </div>



        <div className="flex items-center gap-2 text-sm text-theme-muted">

          <Shield className="h-4 w-4 icon-neon" />

          <span>&copy; {new Date().getFullYear()} {APP_INFO.companyName}</span>

        </div>

      </div>



      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">

        <div className="mb-6 flex w-full max-w-md items-center justify-between lg:hidden">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl nav-item-active">

              <HardHat className="h-5 w-5 icon-neon" />

            </div>

            <p className="font-bold text-theme-primary">{APP_INFO.shortName}</p>

          </div>

          <button

            onClick={toggleTheme}

            className="rounded-xl p-2 text-theme-secondary hover:bg-white/5"

            aria-label="Přepnout režim"

          >

            {theme === 'dark' ? '☀️' : '🌙'}

          </button>

        </div>



        <div className="glass-panel neon-border w-full max-w-md rounded-2xl p-5 sm:p-8">

          {!supabaseConfigured ? (
            <SupabaseConfigNotice />
          ) : migrationSetupRequired ? (
            <MigrationSetupNotice message={bootstrapError} />
          ) : needsBootstrap ? (
            <FirstSetupForm onComplete={() => setNeedsBootstrap(false)} />
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-theme-primary">Přihlášení</h1>
                <p className="mt-2 text-theme-secondary">
                  Přihlášení pouze pro administrátora ERP. Zaměstnanci používají osobní odkaz.
                </p>
              </div>

              {bootstrapError && (
                <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                  {bootstrapError}
                </div>
              )}



              <form onSubmit={handleSubmit} className="space-y-5">

                <Input

                  label="E-mail"

                  type="email"

                  value={email}

                  onChange={(e) => setEmail(e.target.value)}

                  placeholder="váš@email.cz"

                  required

                  autoComplete="email"

                />



                <div className="relative">

                  <Input

                    label="Heslo"

                    type={showPassword ? 'text' : 'password'}

                    value={password}

                    onChange={(e) => setPassword(e.target.value)}

                    placeholder="••••••••"

                    required

                    autoComplete="current-password"

                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="touch-target absolute bottom-2 right-2 rounded-lg p-2 text-theme-muted hover:text-theme-primary"
                    aria-label={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
                  >

                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}

                  </button>

                </div>



                {error && (

                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">

                    {error}

                  </div>

                )}



                <Button type="submit" loading={loading} className="w-full" size="lg">

                  Přihlásit se

                </Button>

              </form>



              <p className="mt-6 text-center text-xs text-theme-muted">
                Pro přístup do systému kontaktujte administrátora.
              </p>
            </>
          )}

        </div>

      </div>

    </div>

  )

}


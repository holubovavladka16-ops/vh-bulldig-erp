import { ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'

export function AccessDeniedPage() {
  const { signOut } = useAuth()

  return (
    <div className="app-background flex min-h-dvh items-center justify-center p-6">
      <div className="glass-panel neon-border max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
          <ShieldX className="h-7 w-7 text-red-400" />
        </div>
        <h1 className="text-xl font-semibold text-theme-primary">Přístup odepřen</h1>
        <p className="mt-2 text-sm text-theme-secondary">
          ERP systém VH Bulldig je neveřejný a přístupný pouze administrátorovi. Zaměstnanci používají
          výhradně osobní odkaz zaslaný administrátorem.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="secondary" onClick={() => signOut()}>
            Odhlásit se
          </Button>
          <Link to="/prihlaseni">
            <Button className="w-full">Přihlášení administrátora</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

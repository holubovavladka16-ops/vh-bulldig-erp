import { useAuth } from '@/context/AuthContext'
import {
  hasModuleAccess,
  canAccessErp,
  getDefaultErpPath,
  isStavbyvedouci,
  shouldRedirectStavbyvedouci,
} from '@/constants/permissions'
import type { ModuleId } from '@/types'
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AccessDeniedPage } from '@/components/auth/AccessDeniedPage'
import { Button } from '@/components/ui/Button'

interface ProtectedRouteProps {
  children: ReactNode
  requiredModule?: ModuleId
}

export function ProtectedRoute({ children, requiredModule }: ProtectedRouteProps) {
  const { user, profile, loading, signOut } = useAuth()
  const { pathname } = useLocation()

  if (loading) {
    return (
      <div className="app-background flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          <p className="text-sm text-theme-muted">Načítání systému…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/prihlaseni" replace />
  }

  if (!profile) {
    return (
      <div className="app-background flex min-h-dvh items-center justify-center p-6">
        <div className="glass-panel neon-border max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-theme-primary">Profil se nepodařilo načíst</h1>
          <p className="mt-2 text-sm text-theme-secondary">
            Přihlášení proběhlo, ale chybí profil uživatele v databázi. Kontaktujte administrátora nebo se
            odhlaste a zkuste to znovu.
          </p>
          <Button className="mt-6" onClick={() => signOut()}>
            Odhlásit se
          </Button>
        </div>
      </div>
    )
  }

  if (!profile.is_active) {
    return (
      <div className="app-background flex min-h-dvh items-center justify-center p-6">
        <div className="glass-panel neon-border max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-theme-primary">Účet deaktivován</h1>
          <p className="mt-2 text-theme-secondary">
            Váš účet byl deaktivován. Kontaktujte administrátora systému.
          </p>
          <Button className="mt-6" variant="secondary" onClick={() => signOut()}>
            Odhlásit se
          </Button>
        </div>
      </div>
    )
  }

  if (!canAccessErp(profile.role)) {
    return <AccessDeniedPage />
  }

  if (isStavbyvedouci(profile.role)) {
    if (shouldRedirectStavbyvedouci(pathname)) {
      return <Navigate to={getDefaultErpPath(profile.role)} replace />
    }
    if (requiredModule && !hasModuleAccess(profile.role, requiredModule)) {
      return <Navigate to={getDefaultErpPath(profile.role)} replace />
    }
    return <>{children}</>
  }

  if (requiredModule && !hasModuleAccess(profile.role, requiredModule)) {
    return <AccessDeniedPage />
  }

  return <>{children}</>
}

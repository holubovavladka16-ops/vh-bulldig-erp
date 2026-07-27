import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { APP_BUILD_VERSION } from '@/constants/branding'
import { APP_INFO, FUTURE_MODULES, MAIN_NAV, SETTINGS_NAV } from '@/constants/navigation'
import { STAVBYVEDOUCi_NAV } from '@/constants/stavbyvedouciNavigation'
import { hasModuleAccess, isAdministrator, isStavbyvedouci } from '@/constants/permissions'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { CompanyLogo } from '@/components/ui/CompanyLogo'
import { NavIcon } from '@/components/ui/NavIcon'
import { RoleBadge } from '@/components/ui/Badge'
import type { SidebarProps } from '@/themes/engine/types'

/**
 * Varianta 14 – Executive Crystal Disc – levé menu.
 *
 * Používá PŘESNĚ stejná data a stejnou logiku oprávnění jako výchozí
 * `Sidebar` (`MAIN_NAV`, `FUTURE_MODULES`, `SETTINGS_NAV`,
 * `hasModuleAccess`, `isStavbyvedouci`, `isAdministrator`) – mění se jen
 * to, jak je menu vykreslené. Žádná routa, oprávnění ani filtrace položek
 * nebyla změněna.
 */
export function CrystalDiscSidebar({ open, onClose }: SidebarProps) {
  const { profile } = useAuth()
  const { settings: companySettings } = useCompanySettings()

  const companyName = companySettings?.company_name ?? APP_INFO.shortName
  const tagline = companySettings?.tagline ?? APP_INFO.tagline

  const isSiteManager = profile ? isStavbyvedouci(profile.role) : false

  const mainItems = isSiteManager
    ? STAVBYVEDOUCi_NAV
    : MAIN_NAV.filter((item) => profile && hasModuleAccess(profile.role, item.module))

  const moduleItems = isSiteManager
    ? []
    : FUTURE_MODULES.filter((item) => profile && hasModuleAccess(profile.role, item.module))

  const settingsItems = isSiteManager
    ? []
    : SETTINGS_NAV.filter((item) => {
        if (!profile) return false
        if (item.adminOnly && !isAdministrator(profile.role)) return false
        return hasModuleAccess(profile.role, item.module)
      })

  const allItems = [...mainItems, ...moduleItems, ...settingsItems]

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-72 flex-col !rounded-none
          border-r transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--border-glass)',
        }}
      >
        <div className="flex h-16 items-center justify-between border-b px-5" style={{ borderColor: 'var(--border-glass)' }}>
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-1"
              style={{
                background:
                  'conic-gradient(from 200deg, rgba(192,160,68,0.55), rgba(255,255,255,0.18) 25%, rgba(143,143,148,0.5) 50%, rgba(255,255,255,0.18) 75%, rgba(192,160,68,0.55))',
                boxShadow: '0 0 0 2px rgba(255,255,255,0.55) inset',
              }}
            >
              <CompanyLogo className="h-full w-full rounded-full object-contain" preferCompany />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-theme-primary">{companyName}</p>
              <p className="truncate text-xs text-theme-muted">{tagline}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="touch-target rounded-lg p-1.5 text-theme-secondary hover:bg-white/5 lg:hidden"
            aria-label="Zavřít menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-premium">
          <ul className="space-y-1.5">
            {allItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                      isActive ? 'text-accent' : 'text-theme-secondary hover:bg-white/5 hover:text-theme-primary'
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                          boxShadow: '0 0 0 1px var(--border-glass-active, var(--border-glass)) inset',
                        }
                      : undefined
                  }
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background:
                        'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9), transparent 45%), conic-gradient(from 200deg, rgba(192,160,68,0.5), rgba(255,255,255,0.15) 25%, rgba(143,143,148,0.45) 50%, rgba(255,255,255,0.15) 75%, rgba(192,160,68,0.5))',
                      boxShadow: '0 0 0 1px rgba(192,160,68,0.4) inset',
                    }}
                  >
                    <NavIcon name={item.icon} className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t p-4" style={{ borderColor: 'var(--border-glass)' }}>
          <p className="mb-1 text-xs text-theme-muted">{APP_INFO.moduleLabel}</p>
          <p className="mb-3 text-[10px] text-theme-muted">Verze {APP_BUILD_VERSION}</p>
          {profile && (
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-accent"
                style={{ boxShadow: '0 0 0 1px var(--border-glass-active, var(--border-glass)) inset' }}
              >
                {profile.full_name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-theme-primary">{profile.full_name}</p>
                <RoleBadge role={profile.role} />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

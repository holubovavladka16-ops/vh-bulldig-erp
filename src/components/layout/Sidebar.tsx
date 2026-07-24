import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { APP_BUILD_VERSION } from '@/constants/branding'
import {
  APP_INFO,
  FUTURE_MODULES,
  MAIN_NAV,
  SETTINGS_NAV,
} from '@/constants/navigation'
import { STAVBYVEDOUCi_NAV } from '@/constants/stavbyvedouciNavigation'
import { hasModuleAccess, isAdministrator, isStavbyvedouci } from '@/constants/permissions'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { CompanyLogo } from '@/components/ui/CompanyLogo'
import { NavIcon } from '@/components/ui/NavIcon'
import { RoleBadge, ModuleBadge } from '@/components/ui/Badge'

/** Moduly bez plné implementace – zobrazí se badge „Připravuje se“. */
const PLACEHOLDER_MODULES = new Set<string>()

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
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

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-72 flex-col
          glass-panel border-r border-[var(--border-glass)] !rounded-none
          transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--border-glass)] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl neon-border bg-white/5 p-1">
              <CompanyLogo className="h-full w-full object-contain" preferCompany />
            </div>
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
          <SidebarSection label={isSiteManager ? 'Pracovní menu' : 'Hlavní'}>
            {mainItems.map((item) => (
              <SidebarLink key={item.id} item={item} onClose={onClose} />
            ))}
          </SidebarSection>

          {!isSiteManager && moduleItems.length > 0 ? (
            <SidebarSection label="Moduly ERP">
              {moduleItems.map((item) => (
                <SidebarLink
                  key={item.id}
                  item={item}
                  onClose={onClose}
                  badge={PLACEHOLDER_MODULES.has(item.id) ? <ModuleBadge /> : undefined}
                />
              ))}
            </SidebarSection>
          ) : null}

          {settingsItems.length > 0 && (
            <SidebarSection label="Správa systému">
              {settingsItems.map((item) => (
                <SidebarLink key={item.id} item={item} onClose={onClose} />
              ))}
            </SidebarSection>
          )}
        </nav>

        <div className="border-t border-[var(--border-glass)] p-4">
          <p className="mb-1 text-xs text-theme-muted">{APP_INFO.moduleLabel}</p>
          <p className="mb-3 text-[10px] text-theme-muted">Verze {APP_BUILD_VERSION}</p>
          {profile && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full neon-border text-sm font-bold text-accent">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
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

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-theme-muted">
        {label}
      </p>
      <ul className="space-y-1">{children}</ul>
    </div>
  )
}

function SidebarLink({
  item,
  onClose,
  badge,
}: {
  item: { id: string; label: string; path: string; icon: string }
  onClose: () => void
  badge?: React.ReactNode
}) {
  return (
    <li>
      <NavLink
        to={item.path}
        end={item.path === '/'}
        onClick={onClose}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
            isActive
              ? 'nav-item-active text-accent'
              : 'text-theme-secondary hover:bg-white/5 hover:text-theme-primary neon-border border-transparent'
          }`
        }
      >
        <NavIcon name={item.icon} neon />
        <span className="flex-1 truncate">{item.label}</span>
        {badge}
      </NavLink>
    </li>
  )
}

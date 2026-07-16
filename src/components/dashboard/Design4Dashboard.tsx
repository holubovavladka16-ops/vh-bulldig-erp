import { AppLayout } from '@/components/layout/AppLayout'
import { CompanyLogo } from '@/components/ui/CompanyLogo'
import { Design4ModuleCard } from '@/components/dashboard/Design4ModuleCard'
import { APP_INFO } from '@/constants/navigation'
import { DESIGN2_DASHBOARD_MODULES } from '@/constants/dashboardModules'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { hasModuleAccess } from '@/constants/permissions'

const PRIMARY_MODULES = DESIGN2_DASHBOARD_MODULES.slice(0, 15)
const LAST_ROW_MODULES = DESIGN2_DASHBOARD_MODULES.slice(15)

export function Design4Dashboard() {
  const { profile } = useAuth()
  const { settings } = useCompanySettings()

  const visibleModules = DESIGN2_DASHBOARD_MODULES.filter(
    (item) => profile && hasModuleAccess(profile.role, item.module)
  )

  const visiblePrimary = PRIMARY_MODULES.filter((item) =>
    visibleModules.some((visible) => visible.number === item.number)
  )
  const visibleLastRow = LAST_ROW_MODULES.filter((item) =>
    visibleModules.some((visible) => visible.number === item.number)
  )

  const brandShort = settings?.company_name?.split(/\s+/)[0]?.toUpperCase() ?? 'BULLDIG'
  const brandTagline = settings?.tagline?.trim() || 'Zemní práce'

  return (
    <AppLayout title="">
      <div className="design4-dashboard">
        <div className="design4-dashboard__brand-bar">
          <div className="design4-dashboard__brand-badge">
            <div className="design4-dashboard__brand-logo-wrap">
              <CompanyLogo className="design4-dashboard__brand-logo" preferCompany />
            </div>
            <div>
              <h3 className="design4-dashboard__brand-short">{brandShort}</h3>
              <p className="design4-dashboard__brand-tagline">{brandTagline}</p>
            </div>
          </div>
        </div>

        <div className="design4-dashboard__container">
          <header className="design4-dashboard__hero">
            <h1 className="design4-dashboard__title">{APP_INFO.name.toUpperCase()}</h1>
            <p className="design4-dashboard__subtitle">
              Zemní výkopové práce inženýrských sítí
            </p>
            <div className="design4-dashboard__divider" aria-hidden="true" />
          </header>

          <div className="design4-modules-grid">
            {visiblePrimary.map((item) => (
              <Design4ModuleCard key={item.number} item={item} />
            ))}
          </div>

          {visibleLastRow.length > 0 && (
            <div className="design4-modules-grid design4-modules-grid--last-row">
              {visibleLastRow.map((item) => (
                <Design4ModuleCard key={item.number} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

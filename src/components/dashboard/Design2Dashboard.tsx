import { AppLayout } from '@/components/layout/AppLayout'
import { CompanyLogo } from '@/components/ui/CompanyLogo'
import { Design2ModuleCard } from '@/components/dashboard/Design2ModuleCard'
import { APP_INFO } from '@/constants/navigation'
import { DESIGN2_DASHBOARD_MODULES } from '@/constants/dashboardModules'
import { useAuth } from '@/context/AuthContext'
import { hasModuleAccess } from '@/constants/permissions'

const PRIMARY_MODULES = DESIGN2_DASHBOARD_MODULES.slice(0, 15)
const LAST_ROW_MODULES = DESIGN2_DASHBOARD_MODULES.slice(15)

export function Design2Dashboard() {
  const { profile } = useAuth()

  const visibleModules = DESIGN2_DASHBOARD_MODULES.filter(
    (item) => profile && hasModuleAccess(profile.role, item.module)
  )

  const visiblePrimary = PRIMARY_MODULES.filter((item) =>
    visibleModules.some((visible) => visible.number === item.number)
  )
  const visibleLastRow = LAST_ROW_MODULES.filter((item) =>
    visibleModules.some((visible) => visible.number === item.number)
  )

  return (
    <AppLayout title="">
      <div className="design2-dashboard">
        <header className="design2-dashboard__hero">
          <div className="design2-dashboard__logo-wrap">
            <CompanyLogo className="design2-dashboard__logo" preferCompany />
          </div>
          <h1 className="design2-dashboard__brand">{APP_INFO.name}</h1>
          <p className="design2-dashboard__subtitle">Přehled modulů</p>
        </header>

        <div className="design2-dashboard__panel">
          <div className="design2-modules-grid">
            {visiblePrimary.map((item) => (
              <Design2ModuleCard key={item.number} item={item} />
            ))}
          </div>

          {visibleLastRow.length > 0 && (
            <div className="design2-modules-grid design2-modules-grid--last-row">
              {visibleLastRow.map((item) => (
                <Design2ModuleCard key={item.number} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

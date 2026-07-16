import { useEffect, useState } from 'react'
import { ClipboardList, ClipboardPen, FileSpreadsheet, Users } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { CompanyLogo } from '@/components/ui/CompanyLogo'
import { Design5HexKpi, Design5ModuleCard } from '@/components/dashboard/Design5Parts'
import { APP_INFO } from '@/constants/navigation'
import { DESIGN2_DASHBOARD_MODULES } from '@/constants/dashboardModules'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { hasModuleAccess } from '@/constants/permissions'
import { fetchDashboardStats, type DashboardStats } from '@/lib/dashboard/stats'

const PRIMARY_MODULES = DESIGN2_DASHBOARD_MODULES.slice(0, 15)
const LAST_ROW_MODULES = DESIGN2_DASHBOARD_MODULES.slice(15)

export function Design5Dashboard() {
  const { profile } = useAuth()
  const { settings } = useCompanySettings()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsError, setStatsError] = useState('')
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((err) =>
        setStatsError(err instanceof Error ? err.message : 'Načtení přehledu se nezdařilo')
      )
      .finally(() => setLoading(false))
  }, [])

  const kpiValue = (value: number | undefined) => {
    if (loading) return '…'
    if (statsError) return '—'
    return String(value ?? 0)
  }

  return (
    <AppLayout title="">
      <div className="design5-dashboard">
        <div className="design5-dashboard__brand-bar">
          <div className="design5-dashboard__brand-badge">
            <div className="design5-dashboard__brand-logo-wrap">
              <CompanyLogo className="design5-dashboard__brand-logo" preferCompany />
            </div>
            <div>
              <h3 className="design5-dashboard__brand-short">{brandShort}</h3>
              <p className="design5-dashboard__brand-tagline">{brandTagline}</p>
            </div>
          </div>
        </div>

        <div className="design5-dashboard__container">
          <header className="design5-dashboard__hero">
            <p className="design5-dashboard__eyebrow">Executive Black Edition</p>
            <h1 className="design5-dashboard__title">{APP_INFO.name.toUpperCase()}</h1>
            <p className="design5-dashboard__subtitle">
              Zemní výkopové práce inženýrských sítí
            </p>
            <div className="design5-dashboard__divider" aria-hidden="true" />
          </header>

          <div className="design5-kpi-grid">
            <Design5HexKpi
              label="Aktivní dělníci"
              value={kpiValue(stats?.activeWorkers)}
              icon={Users}
            />
            <Design5HexKpi
              label="Aktivní zakázky"
              value={kpiValue(stats?.activeOrders)}
              icon={ClipboardList}
            />
            <Design5HexKpi
              label="Výkazy ke schválení"
              value={kpiValue(stats?.pendingReports)}
              icon={FileSpreadsheet}
            />
            <Design5HexKpi
              label="Odeslané formuláře"
              value={kpiValue(stats?.submittedForms)}
              icon={ClipboardPen}
            />
          </div>

          {statsError && <p className="design5-dashboard__error">{statsError}</p>}

          <div className="design5-modules-grid">
            {visiblePrimary.map((item) => (
              <Design5ModuleCard key={item.number} item={item} />
            ))}
          </div>

          {visibleLastRow.length > 0 && (
            <div className="design5-modules-grid design5-modules-grid--last-row">
              {visibleLastRow.map((item) => (
                <Design5ModuleCard key={item.number} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, FileSpreadsheet, TrendingUp, Users } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { CompanyLogo } from '@/components/ui/CompanyLogo'
import {
  Design6HexKpi,
  Design6ModuleCard,
  Design6QuickAction,
} from '@/components/dashboard/Design6Parts'
import { Design6ProfitChart } from '@/components/dashboard/Design6ProfitChart'
import { Design6ActiveOrders } from '@/components/dashboard/Design6ActiveOrders'
import { APP_INFO } from '@/constants/navigation'
import { DESIGN2_DASHBOARD_MODULES } from '@/constants/dashboardModules'
import { formatCurrency } from '@/constants/workers'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { hasModuleAccess } from '@/constants/permissions'
import type { ModuleId } from '@/types'
import { fetchDesign6DashboardStats, type Design6DashboardStats } from '@/lib/dashboard/stats'

const PRIMARY_MODULES = DESIGN2_DASHBOARD_MODULES.slice(0, 15)
const LAST_ROW_MODULES = DESIGN2_DASHBOARD_MODULES.slice(15)

const QUICK_ACTIONS: {
  path: string
  label: string
  icon: string
  module: ModuleId
}[] = [
  { path: '/vykazy', label: 'Nový výkaz', icon: 'FileSpreadsheet', module: 'vykazy' },
  { path: '/dochazka', label: 'Docházka', icon: 'Clock', module: 'dochazka' },
  { path: '/denik', label: 'Stavební deník', icon: 'BookOpen', module: 'denik' },
  { path: '/mapa-vykopu', label: 'GPS trasa', icon: 'Route', module: 'mapa-vykopu' },
  { path: '/ekonomika', label: 'Přidat náklady', icon: 'Landmark', module: 'ekonomika' },
  { path: '/zakazky', label: 'Přidat zakázku', icon: 'ClipboardList', module: 'zakazky' },
]

export function Design6Dashboard() {
  const { profile } = useAuth()
  const { settings } = useCompanySettings()
  const [stats, setStats] = useState<Design6DashboardStats | null>(null)
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

  const visibleQuickActions = useMemo(
    () =>
      QUICK_ACTIONS.filter(
        (item) => profile && hasModuleAccess(profile.role, item.module)
      ),
    [profile]
  )

  const brandShort = settings?.company_name?.split(/\s+/)[0]?.toUpperCase() ?? 'BULLDIG'
  const brandTagline = settings?.tagline?.trim() || 'Zemní práce'

  useEffect(() => {
    fetchDesign6DashboardStats()
      .then(setStats)
      .catch((err) =>
        setStatsError(err instanceof Error ? err.message : 'Načtení přehledu se nezdařilo')
      )
      .finally(() => setLoading(false))
  }, [])

  const countValue = (value: number | undefined) => {
    if (loading) return '…'
    if (statsError) return '—'
    return String(value ?? 0)
  }

  const profitValue = () => {
    if (loading) return '…'
    if (statsError) return '—'
    return formatCurrency(stats?.monthlyProfit ?? 0)
  }

  return (
    <AppLayout title="">
      <div className="design6-dashboard">
        <div className="design6-dashboard__brand-bar">
          <div className="design6-dashboard__brand-badge">
            <div className="design6-dashboard__brand-logo-wrap">
              <CompanyLogo className="design6-dashboard__brand-logo" preferCompany />
            </div>
            <div>
              <h3 className="design6-dashboard__brand-short">{brandShort}</h3>
              <p className="design6-dashboard__brand-tagline">{brandTagline}</p>
            </div>
          </div>
        </div>

        <div className="design6-dashboard__container">
          <header className="design6-dashboard__hero">
            <p className="design6-dashboard__eyebrow">Cyber-Infrastructure Edition</p>
            <h1 className="design6-dashboard__title">{APP_INFO.name.toUpperCase()}</h1>
            <p className="design6-dashboard__subtitle">
              Zemní výkopové práce inženýrských sítí
            </p>
            <div className="design6-dashboard__divider" aria-hidden="true" />
          </header>

          <div className="design6-kpi-grid">
            <Design6HexKpi
              label="Aktivní zakázky"
              value={countValue(stats?.activeOrders)}
              icon={ClipboardList}
              accent="cyan"
            />
            <Design6HexKpi
              label="Zaměstnanci dnes"
              value={countValue(stats?.employeesToday)}
              icon={Users}
              accent="blue"
            />
            <Design6HexKpi
              label="Výkazy ke kontrole"
              value={countValue(stats?.pendingReports)}
              icon={FileSpreadsheet}
              accent="green"
            />
            <Design6HexKpi
              label="Měsíční zisk"
              value={profitValue()}
              icon={TrendingUp}
              accent="gold"
            />
          </div>

          {statsError && <p className="design6-dashboard__error">{statsError}</p>}

          <div className="design6-dashboard__insights">
            <Design6ProfitChart points={stats?.profitTrend ?? []} loading={loading} />
            {profile && hasModuleAccess(profile.role, 'zakazky') && (
              <Design6ActiveOrders orders={stats?.activeOrdersList ?? []} loading={loading} />
            )}
          </div>

          {visibleQuickActions.length > 0 && (
            <section className="design6-quick-actions" aria-label="Rychlé akce">
              <h2 className="design6-section-title">Rychlé akce</h2>
              <div className="design6-quick-actions__grid">
                {visibleQuickActions.map((item) => (
                  <Design6QuickAction
                    key={item.path}
                    path={item.path}
                    label={item.label}
                    icon={item.icon}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="design6-modules-section" aria-label="Přehled modulů">
            <h2 className="design6-section-title">Přehled modulů ERP</h2>
            <div className="design6-modules-grid">
              {visiblePrimary.map((item) => (
                <Design6ModuleCard key={item.number} item={item} />
              ))}
            </div>

            {visibleLastRow.length > 0 && (
              <div className="design6-modules-grid design6-modules-grid--last-row">
                {visibleLastRow.map((item) => (
                  <Design6ModuleCard key={item.number} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  )
}

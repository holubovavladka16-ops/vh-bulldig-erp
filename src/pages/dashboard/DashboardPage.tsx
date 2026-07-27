import { useEffect, useState } from 'react'
import { Users, ClipboardList, FileSpreadsheet, ClipboardPen } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { FUTURE_MODULES } from '@/constants/navigation'
import { hasModuleAccess, ROLE_LABELS } from '@/constants/permissions'
import { fetchDashboardStats, type DashboardStats } from '@/lib/dashboard/stats'
import { useModuleCardComponent, useStatPanelComponent } from '@/themes/engine/useThemedComponents'

const QUICK_LINKS = [
  { path: '/delnici', label: 'Dělníci', icon: 'HardHat' },
  { path: '/vykazy', label: 'Výkazy', icon: 'FileSpreadsheet' },
  { path: '/zakazky', label: 'Zakázky', icon: 'ClipboardList' },
  { path: '/denik', label: 'Stavební deník', icon: 'BookOpen' },
] as const

export function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsError, setStatsError] = useState('')
  const [loading, setLoading] = useState(true)
  const StatPanel = useStatPanelComponent()
  const ModuleCard = useModuleCardComponent()

  const accessibleModules = FUTURE_MODULES.filter(
    (item) => profile && hasModuleAccess(profile.role, item.module)
  )

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((err) =>
        setStatsError(err instanceof Error ? err.message : 'Načtení přehledu se nezdařilo')
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout title="Přehled">
      <PageHeader
        title={`Vítejte, ${profile?.full_name ?? 'uživateli'}`}
        description="Přehled provozu VH Bulldig ERP – aktuální stav zakázek, zaměstnanců a výkazů."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatPanel
          label="Aktivní dělníci"
          value={loading ? '…' : statsError ? '—' : String(stats?.activeWorkers ?? 0)}
          icon={Users}
          sublabel={stats?.activeWorkers === 0 && !loading && !statsError ? 'Žádní aktivní zaměstnanci' : undefined}
        />
        <StatPanel
          label="Aktivní zakázky"
          value={loading ? '…' : statsError ? '—' : String(stats?.activeOrders ?? 0)}
          icon={ClipboardList}
          sublabel={stats?.activeOrders === 0 && !loading && !statsError ? 'Žádné aktivní zakázky' : undefined}
        />
        <StatPanel
          label="Výkazy ke schválení"
          value={loading ? '…' : statsError ? '—' : String(stats?.pendingReports ?? 0)}
          icon={FileSpreadsheet}
          sublabel={
            stats?.pendingReports
              ? 'Čekají na schválení administrátorem'
              : !loading && !statsError
                ? 'Všechny výkazy jsou vyřízeny'
                : undefined
          }
        />
        <StatPanel
          label="Odeslané formuláře"
          value={loading ? '…' : statsError ? '—' : String(stats?.submittedForms ?? 0)}
          icon={ClipboardPen}
          sublabel={profile ? ROLE_LABELS[profile.role] : undefined}
        />
      </div>

      {statsError && (
        <p className="mt-4 text-sm text-red-400">{statsError}</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Rychlé odkazy" description="Nejčastěji používané moduly" />
          <div className="grid gap-2 sm:grid-cols-2">
            {QUICK_LINKS.filter((item) =>
              accessibleModules.some((m) => m.path === item.path)
            ).map((item) => (
              <ModuleCard key={item.path} href={item.path} icon={item.icon} label={item.label} />
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Moduly ERP" description="Všechny dostupné sekce systému" />
          <div className="grid gap-2 sm:grid-cols-2 dashboard-module-grid">
            {accessibleModules.map((item) => (
              <ModuleCard key={item.id} href={item.path} icon={item.icon} label={item.label} />
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}

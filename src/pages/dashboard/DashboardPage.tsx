import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Users, ClipboardList, FileSpreadsheet, ClipboardPen } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { FUTURE_MODULES } from '@/constants/navigation'
import { hasModuleAccess, ROLE_LABELS } from '@/constants/permissions'
import { NavIcon } from '@/components/ui/NavIcon'
import { fetchDashboardStats, type DashboardStats } from '@/lib/dashboard/stats'

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
        <StatCard
          label="Aktivní dělníci"
          value={loading ? '…' : statsError ? '—' : String(stats?.activeWorkers ?? 0)}
          icon={Users}
          sublabel={stats?.activeWorkers === 0 && !loading && !statsError ? 'Žádní aktivní zaměstnanci' : undefined}
        />
        <StatCard
          label="Aktivní zakázky"
          value={loading ? '…' : statsError ? '—' : String(stats?.activeOrders ?? 0)}
          icon={ClipboardList}
          sublabel={stats?.activeOrders === 0 && !loading && !statsError ? 'Žádné aktivní zakázky' : undefined}
        />
        <StatCard
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
        <StatCard
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
              <Link
                key={item.path}
                to={item.path}
                className="neon-border flex items-center gap-3 rounded-xl p-3 transition-all duration-300 hover:bg-white/5"
              >
                <div className="rounded-lg p-2 nav-item-active">
                  <NavIcon name={item.icon} className="h-4 w-4" neon />
                </div>
                <span className="flex-1 text-sm font-medium text-theme-primary">{item.label}</span>
                <ArrowRight className="h-4 w-4 text-theme-muted" />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Moduly ERP" description="Všechny dostupné sekce systému" />
          <div className="grid gap-2 sm:grid-cols-2">
            {accessibleModules.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className="neon-border flex items-center gap-3 rounded-xl p-3 transition-all duration-300 hover:bg-white/5"
              >
                <div className="rounded-lg p-2 nav-item-active">
                  <NavIcon name={item.icon} className="h-4 w-4" neon />
                </div>
                <span className="flex-1 text-sm font-medium text-theme-primary">{item.label}</span>
                <ArrowRight className="h-4 w-4 text-theme-muted" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  sublabel,
}: {
  label: string
  value: string
  icon: typeof Users
  sublabel?: string
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-theme-secondary">{label}</p>
          <p className="mt-1 text-2xl font-bold text-theme-primary">{value}</p>
          {sublabel && <p className="mt-1 text-xs text-theme-muted">{sublabel}</p>}
        </div>
        <div className="rounded-xl p-3 nav-item-active">
          <Icon className="h-6 w-6 icon-neon" />
        </div>
      </div>
    </Card>
  )
}

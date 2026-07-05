import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { NavIcon } from '@/components/ui/NavIcon'
import { SETTINGS_NAV } from '@/constants/navigation'
import { useAuth } from '@/context/AuthContext'
import { hasModuleAccess, isAdministrator } from '@/constants/permissions'

export function SettingsHubPage() {
  const { profile } = useAuth()

  const items = SETTINGS_NAV.filter((item) => {
    if (!profile) return false
    if (item.adminOnly && !isAdministrator(profile.role)) return false
    return hasModuleAccess(profile.role, item.module)
  })

  return (
    <AppLayout title="Nastavení">
      <PageHeader
        title="Nastavení systému"
        description="Správa společnosti, profilu, rolí uživatelů a aplikace."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Link key={item.id} to={item.path}>
            <Card className="h-full transition-all duration-300 hover:scale-[1.01]">
              <div className="flex items-start gap-4">
                <div className="rounded-xl p-3 nav-item-active">
                  <NavIcon name={item.icon} className="h-6 w-6" neon />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-theme-primary">{item.label}</h3>
                  <p className="mt-1 text-sm text-theme-muted">
                    {getSettingsDescription(item.id)}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-theme-muted" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </AppLayout>
  )
}

function getSettingsDescription(id: string): string {
  const descriptions: Record<string, string> = {
    'nastaveni-spolecnost': 'Firemní údaje, IČO, DIČ, kontakty, logo a jednatel',
    'nastaveni-profil': 'Osobní profil administrátora a kontaktní údaje',
    'nastaveni-opravneni': 'Správa rolí uživatelů v systému',
    'nastaveni-aplikace': 'Vzhled, režim, notifikace a automatické ukládání',
  }
  return descriptions[id] ?? ''
}

import { Link } from 'react-router-dom'
import { Construction, ArrowRight } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ModuleBadge } from '@/components/ui/Badge'
import { NavIcon } from '@/components/ui/NavIcon'
import { FUTURE_MODULES } from '@/constants/navigation'

interface ModulePlaceholderPageProps {
  moduleId: string
}

export function ModulePlaceholderPage({ moduleId }: ModulePlaceholderPageProps) {
  const navItem = FUTURE_MODULES.find((item) => item.id === moduleId)

  if (!navItem) return null

  return (
    <AppLayout title={navItem.label}>
      <PageHeader
        title={navItem.label}
        description="Modul je registrován v architektuře ERP a čeká na implementaci."
      />

      <div className="flex flex-col items-center justify-center py-12">
        <Card className="max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl nav-item-active">
            <NavIcon name={navItem.icon} className="h-10 w-10" neon />
          </div>

          <ModuleBadge />

          <h2 className="mt-4 text-xl font-bold text-theme-primary">{navItem.label}</h2>
          <p className="mt-2 text-theme-secondary">
            Tento modul je připraven v modulární architektuře systému VH Bulldig ERP.
            Plná funkcionalita bude doplněna v rámci dalšího modulu dle specifikace.
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            <Construction className="h-4 w-4" />
            <span>Modul ve frontě implementace</span>
          </div>

          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            Zpět na přehled
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    </AppLayout>
  )
}

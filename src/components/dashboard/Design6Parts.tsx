import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { NavIcon } from '@/components/ui/NavIcon'
import type { DashboardModuleItem } from '@/constants/dashboardModules'

interface Design6HexKpiProps {
  label: string
  value: string
  icon: LucideIcon
  accent?: 'cyan' | 'blue' | 'green' | 'violet' | 'pink' | 'gold'
}

export function Design6HexKpi({
  label,
  value,
  icon: Icon,
  accent = 'gold',
}: Design6HexKpiProps) {
  return (
    <div className={`design6-hex-kpi design6-hex-kpi--${accent}`}>
      <div className="design6-hex-kpi__frame" aria-hidden="true" />
      <div className="design6-hex-kpi__body">
        <Icon className="design6-hex-kpi__icon" aria-hidden="true" />
        <span className="design6-hex-kpi__value">{value}</span>
        <span className="design6-hex-kpi__label">{label}</span>
      </div>
    </div>
  )
}

interface Design6QuickActionProps {
  path: string
  label: string
  icon: string
}

export function Design6QuickAction({ path, label, icon }: Design6QuickActionProps) {
  return (
    <Link to={path} className="design6-quick-action">
      <span className="design6-quick-action__icon-wrap">
        <NavIcon name={icon} className="design6-quick-action__icon" neon />
      </span>
      <span className="design6-quick-action__label">{label}</span>
    </Link>
  )
}

interface Design6ModuleCardProps {
  item: DashboardModuleItem
}

export function Design6ModuleCard({ item }: Design6ModuleCardProps) {
  return (
    <Link
      to={item.path}
      className="design6-module-card group"
      aria-label={`${item.number}. ${item.label}`}
    >
      <span className="design6-module-card__number">{String(item.number).padStart(2, '0')}</span>
      <div className="design6-module-card__glow" aria-hidden="true" />
      <div className="design6-module-card__body">
        <div className="design6-module-card__content">
          <NavIcon name={item.icon} className="design6-module-card__icon" neon />
          <span className="design6-module-card__label">{item.label}</span>
        </div>
      </div>
    </Link>
  )
}

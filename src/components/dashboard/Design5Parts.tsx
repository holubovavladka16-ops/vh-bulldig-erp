import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { NavIcon } from '@/components/ui/NavIcon'
import type { DashboardModuleItem } from '@/constants/dashboardModules'

interface Design5HexKpiProps {
  label: string
  value: string
  icon: LucideIcon
}

export function Design5HexKpi({ label, value, icon: Icon }: Design5HexKpiProps) {
  return (
    <div className="design5-hex-kpi">
      <div className="design5-hex-kpi__frame" aria-hidden="true" />
      <div className="design5-hex-kpi__body">
        <Icon className="design5-hex-kpi__icon" aria-hidden="true" />
        <span className="design5-hex-kpi__value">{value}</span>
        <span className="design5-hex-kpi__label">{label}</span>
      </div>
    </div>
  )
}

interface Design5ModuleCardProps {
  item: DashboardModuleItem
}

export function Design5ModuleCard({ item }: Design5ModuleCardProps) {
  return (
    <Link
      to={item.path}
      className="design5-module-card group"
      aria-label={`${item.number}. ${item.label}`}
    >
      <span className="design5-module-card__number">{String(item.number).padStart(2, '0')}</span>
      <div className="design5-module-card__icon-wrap">
        <NavIcon name={item.icon} className="design5-module-card__icon" neon />
      </div>
      <span className="design5-module-card__label">{item.label}</span>
    </Link>
  )
}

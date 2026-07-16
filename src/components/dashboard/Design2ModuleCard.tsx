import { Link } from 'react-router-dom'
import { NavIcon } from '@/components/ui/NavIcon'
import type { DashboardModuleItem } from '@/constants/dashboardModules'

interface Design2ModuleCardProps {
  item: DashboardModuleItem
}

export function Design2ModuleCard({ item }: Design2ModuleCardProps) {
  return (
    <Link
      to={item.path}
      className={`design2-module-card design2-module-card--${item.number}`}
      aria-label={`${item.number}. ${item.label}`}
    >
      <span className="design2-module-card__number">{item.number}</span>
      <div className="design2-module-card__icon-wrap">
        <NavIcon name={item.icon} className="design2-module-card__icon" neon />
      </div>
      <p className="design2-module-card__label">{item.label}</p>
    </Link>
  )
}

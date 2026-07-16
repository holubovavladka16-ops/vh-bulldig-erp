import { Link } from 'react-router-dom'
import { NavIcon } from '@/components/ui/NavIcon'
import type { DashboardModuleItem } from '@/constants/dashboardModules'

interface Design4ModuleCardProps {
  item: DashboardModuleItem
}

export function Design4ModuleCard({ item }: Design4ModuleCardProps) {
  return (
    <Link
      to={item.path}
      className="design4-diamond-card group"
      aria-label={`${item.number}. ${item.label}`}
    >
      <span className="design4-diamond-card__number">{String(item.number).padStart(2, '0')}</span>
      <div className="design4-diamond-card__glow" aria-hidden="true" />
      <div className="design4-diamond-card__body">
        <div className="design4-diamond-card__content">
          <NavIcon name={item.icon} className="design4-diamond-card__icon" neon />
          <span className="design4-diamond-card__label">{item.label}</span>
        </div>
      </div>
    </Link>
  )
}

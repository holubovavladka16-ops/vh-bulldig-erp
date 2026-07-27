import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { NavIcon } from '@/components/ui/NavIcon'
import type { ModuleCardProps } from '@/themes/engine/types'

/**
 * Výchozí karta modulu – přesně stejný vzhled, jaký měla aplikace před
 * zavedením Theme Engine. Používají ji všechny motivy, které nemají
 * vlastní registrovanou komponentu (viz `themes/engine/registry.ts`).
 */
export function DefaultModuleCard({ href, icon, label }: ModuleCardProps) {
  return (
    <Link
      to={href}
      className="neon-border flex items-center gap-3 rounded-xl p-3 transition-all duration-300 hover:bg-white/5"
    >
      <div className="rounded-lg p-2 nav-item-active">
        <NavIcon name={icon} className="h-4 w-4" neon />
      </div>
      <span className="flex-1 text-sm font-medium text-theme-primary">{label}</span>
      <ArrowRight className="h-4 w-4 text-theme-muted" />
    </Link>
  )
}

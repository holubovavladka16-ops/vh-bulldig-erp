import { Link } from 'react-router-dom'
import { NavIcon } from '@/components/ui/NavIcon'
import type { ModuleCardProps } from '@/themes/engine/types'

/**
 * Varianta 14 – Executive Crystal Disc.
 *
 * Skutečně odlišná struktura (ne jen přebarvení): kruhový "CD disk" se
 * středovým chromovým kotoučem a názvem modulu pod ním, místo běžného
 * vodorovného řádku s ikonou vlevo. Data i routa jsou naprosto stejná
 * jako u výchozí karty – mění se jen to, jak se vykreslí.
 */
export function CrystalDiscModuleCard({ href, icon, label }: ModuleCardProps) {
  return (
    <Link
      to={href}
      className="group flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-transform duration-300 hover:-translate-y-1"
    >
      <span
        className="relative flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background:
            'conic-gradient(from 200deg, rgba(192,160,68,0.55), rgba(255,255,255,0.18) 25%, rgba(143,143,148,0.5) 50%, rgba(255,255,255,0.18) 75%, rgba(192,160,68,0.55))',
          boxShadow: '0 0 0 2px rgba(255,255,255,0.55) inset, 0 6px 14px rgba(0,0,0,0.2)',
          border: '1px solid rgba(192,160,68,0.5)',
        }}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-300 group-hover:rotate-12"
          style={{
            background: 'radial-gradient(circle, rgba(210,210,214,0.95), rgba(140,140,145,0.9))',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.5) inset',
          }}
        >
          <NavIcon name={icon} className="h-4 w-4" />
        </span>
      </span>
      <span className="text-xs font-medium leading-tight text-theme-primary">{label}</span>
    </Link>
  )
}

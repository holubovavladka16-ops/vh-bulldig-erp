import type { LucideIcon } from 'lucide-react'

/**
 * Theme Engine – sdílené datové kontrakty (props) pro „vyměnitelné" oblasti
 * rozhraní.
 *
 * DŮLEŽITÉ: tyto typy popisují jen DATA a AKCE (routa, popisek, ikona,
 * hodnota) – nikdy ne vzhled. Každý motiv smí data zobrazit úplně jinak
 * (jiný tvar, jiné rozložení, jiná animace), ale nesmí měnit, jaká data
 * dostane, kam vede odkaz, ani žádnou funkční/business logiku.
 */

/** Levé navigační menu. */
export interface SidebarProps {
  open: boolean
  onClose: () => void
}

/** Horní panel aplikace. */
export interface HeaderProps {
  title: string
  onMenuClick: () => void
  action?: import('react').ReactNode
}

/** Jedna karta modulu v přehledu (Dashboard → „Moduly ERP" / „Rychlé odkazy"). */
export interface ModuleCardProps {
  /** Routa modulu – beze změny napříč všemi motivy. */
  href: string
  /** Název ikony z NavIcon registru – beze změny napříč všemi motivy. */
  icon: string
  /** Skutečný název modulu – beze změny napříč všemi motivy. */
  label: string
}

/** Jeden statistický panel v horní části Dashboardu. */
export interface StatPanelProps {
  label: string
  value: string
  icon: LucideIcon
  sublabel?: string
}

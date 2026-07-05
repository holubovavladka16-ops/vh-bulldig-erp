import {
  LayoutDashboard,
  Clock,
  Users,
  HardHat,
  ClipboardList,
  ClipboardPen,
  FileSpreadsheet,
  BookOpen,
  Landmark,
  Wallet,
  Cable,
  Camera,
  FileText,
  BarChart3,
  Settings,
  Building2,
  UserCircle,
  Shield,
  SlidersHorizontal,
  Receipt,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Clock,
  Users,
  HardHat,
  ClipboardList,
  ClipboardPen,
  FileSpreadsheet,
  BookOpen,
  Landmark,
  Wallet,
  Cable,
  Camera,
  FileText,
  BarChart3,
  Settings,
  Building2,
  UserCircle,
  Shield,
  SlidersHorizontal,
  Receipt,
}

interface NavIconProps {
  name: string
  className?: string
  neon?: boolean
}

export function NavIcon({ name, className = 'h-5 w-5', neon = false }: NavIconProps) {
  const Icon = iconMap[name]
  if (!Icon) return null
  return <Icon className={`${className} ${neon ? 'icon-neon' : ''}`} />
}

export { iconMap }

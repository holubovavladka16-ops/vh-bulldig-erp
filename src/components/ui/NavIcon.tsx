import {
  LayoutDashboard,
  Clock,
  Users,
  HardHat,
  ClipboardList,
  ClipboardPen,
  FileSpreadsheet,
  FileStack,
  BookOpen,
  Landmark,
  Wallet,
  Cable,
  Camera,
  MapPin,
  Route,
  FileText,
  BarChart3,
  Settings,
  Building2,
  UserCircle,
  Shield,
  SlidersHorizontal,
  Receipt,
  Palette,
  LogIn,
  Tags,
  Database,
  Droplets,
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
  FileStack,
  BookOpen,
  Landmark,
  Wallet,
  Cable,
  Camera,
  MapPin,
  Route,
  FileText,
  BarChart3,
  Settings,
  Building2,
  UserCircle,
  Shield,
  SlidersHorizontal,
  Receipt,
  Palette,
  LogIn,
  Tags,
  Database,
  Droplets,
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

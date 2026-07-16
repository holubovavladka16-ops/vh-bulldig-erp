import type { AppDesign } from '@/types'

export interface AppDesignOption {
  id: AppDesign
  label: string
  description: string
}

export const APP_DESIGN_OPTIONS: AppDesignOption[] = [
  {
    id: 'design_1',
    label: 'Design 1 – Původní',
    description:
      'Současný vzhled aplikace s dynamickými akcenty a skleněnými panely. Bezpečná původní varianta.',
  },
  {
    id: 'design_2',
    label: 'Design 2 – Prémiový',
    description:
      'Tmavé modročerné pozadí, zlaté rámečky, tyrkysové akcenty a jemné světelné efekty pro reprezentativní firemní prezentaci.',
  },
  {
    id: 'design_3',
    label: 'Design 3 – Purpur & růžové zlato',
    description:
      'Luxusní fialové pozadí, růžově zlaté akcenty a kosočtvercové moduly na dashboardu. Stejná logika aplikace, reprezentativní vzhled.',
  },
  {
    id: 'design_4',
    label: 'Design 4 – Průmyslový modrý & měděný kov',
    description:
      'Tmavě modré až černé pozadí, měděné rámečky, tyrkysové akcenty a kosočtvercové moduly. Průmyslový technický vzhled pro reprezentativní prezentaci.',
  },
  {
    id: 'design_5',
    label: 'Design 5 – Executive Black Edition',
    description:
      'Matně černé pozadí s karbonovou strukturou, zlaté linky a hexagonální KPI panely. Reprezentativní dashboard pro vedení firmy.',
  },
  {
    id: 'design_6',
    label: 'Design 6 – Cyber-Infrastructure Edition',
    description:
      'Futuristické tmavé pozadí se sítí a gridem, jemné neonové akcenty, hexagonální KPI a technické moduly. Profesionální čitelnost tabulek a formulářů.',
  },
]

export const VALID_APP_DESIGNS = new Set<AppDesign>([
  'design_1',
  'design_2',
  'design_3',
  'design_4',
  'design_5',
  'design_6',
])

export const PREMIUM_DASHBOARD_DESIGNS = new Set<AppDesign>([
  'design_2',
  'design_3',
  'design_4',
  'design_5',
  'design_6',
])

export function isPremiumDashboardDesign(design: AppDesign): boolean {
  return PREMIUM_DASHBOARD_DESIGNS.has(design)
}

export function normalizeAppDesign(value: unknown): AppDesign {
  if (typeof value === 'string' && VALID_APP_DESIGNS.has(value as AppDesign)) {
    return value as AppDesign
  }
  return 'design_1'
}

export function getAppDesignLabel(design: AppDesign): string {
  return APP_DESIGN_OPTIONS.find((option) => option.id === design)?.label ?? 'Design 1 – Původní'
}

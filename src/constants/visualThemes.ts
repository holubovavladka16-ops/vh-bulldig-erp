export type VisualThemeId =
  | 'neon-glass'
  | 'black-gold'
  | 'premium-gold'
  | 'purple-premium'
  | 'industrial-blue'

export interface VisualThemeDefinition {
  id: VisualThemeId
  label: string
  description: string
  preview: {
    background: string
    accent: string
    accentSecondary: string
  }
}

export const VISUAL_THEMES: VisualThemeDefinition[] = [
  {
    id: 'neon-glass',
    label: 'Neon Glass',
    description: 'Skleněné panely, neonové okraje a plynulá rotace akcentů.',
    preview: { background: '#0a0e17', accent: '#06b6d4', accentSecondary: '#a855f7' },
  },
  {
    id: 'black-gold',
    label: 'Black & Gold',
    description: 'Elegantní černé pozadí se zlatými akcenty.',
    preview: { background: '#0a0a0a', accent: '#d4af37', accentSecondary: '#b8860b' },
  },
  {
    id: 'premium-gold',
    label: 'Premium Gold',
    description: 'Teplé tmavé tóny s bohatou zlatou paletou.',
    preview: { background: '#14100c', accent: '#e8b923', accentSecondary: '#c9971a' },
  },
  {
    id: 'purple-premium',
    label: 'Purple Premium',
    description: 'Hluboké fialové pozadí s prémiovým neonovým efektem.',
    preview: { background: '#120818', accent: '#a855f7', accentSecondary: '#7c3aed' },
  },
  {
    id: 'industrial-blue',
    label: 'Industrial Blue',
    description: 'Průmyslová modrá paleta pro technický vzhled.',
    preview: { background: '#0f1419', accent: '#3b82f6', accentSecondary: '#1e40af' },
  },
]

export const DEFAULT_VISUAL_THEME: VisualThemeId = 'neon-glass'

export const VISUAL_THEME_IDS = VISUAL_THEMES.map((theme) => theme.id)

export function isVisualThemeId(value: string): value is VisualThemeId {
  return VISUAL_THEME_IDS.includes(value as VisualThemeId)
}

export function getVisualThemeDefinition(id: VisualThemeId): VisualThemeDefinition {
  return VISUAL_THEMES.find((theme) => theme.id === id) ?? VISUAL_THEMES[0]
}

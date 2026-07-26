export type VisualThemeId =
  | 'neon-glass'
  | 'black-gold'
  | 'premium-gold'
  | 'purple-premium'
  | 'industrial-blue'
  | 'executive-gold-glass'
  | 'executive-crystal-disc'
  | 'signature-elite'
  | 'design-2'
  | 'industrial-diamond'
  | 'executive-purple-bronze'
  | 'executive-gold-black-hex'
  | 'enterprise-unified'
  | 'neon-crystal-tech'
  | 'modern-office-professional'
  | 'modern-silver-3d'
  | 'professional-office-green'
  | 'dark-elegance-premium'
  | 'crystal-office-folder'
  | 'office-crystal-double-square'

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
  {
    id: 'executive-gold-glass',
    label: 'Executive Gold Glass',
    description: 'Luxusní bílo-zlato-černý motiv se skleněnými boxy pro vedení firmy.',
    preview: { background: '#faf9f6', accent: '#c9a227', accentSecondary: '#8a6d1f' },
  },
  {
    id: 'executive-crystal-disc',
    label: 'Executive Crystal Disc',
    description: 'Luxusní bílý motiv s moduly ve tvaru skleněných CD disků se zlatým a chromovým leskem.',
    preview: { background: '#fafaf8', accent: '#c0a044', accentSecondary: '#8f8f94' },
  },
  {
    id: 'signature-elite',
    label: 'Signature Elite',
    description: 'Vlajkový motiv VH Bulldig – slonová bílá, antracit a champagne zlatá s tyrkysovými akcenty.',
    preview: { background: '#f6f3ec', accent: '#2fb8ac', accentSecondary: '#c9b37a' },
  },
  {
    id: 'design-2',
    label: 'Design 2 – Reprezentativní Dashboard',
    description: 'Prémiový černomodrý motiv s tyrkysovými a zlatými akcenty.',
    preview: { background: '#0a0e14', accent: '#14b8a6', accentSecondary: '#c9a227' },
  },
  {
    id: 'industrial-diamond',
    label: 'Motiv 4 – Průmyslový a technický',
    description: 'Ocelově modrý industriální motiv s měděnými akcenty a kosočtvercovými kartami modulů.',
    preview: { background: '#0f1720', accent: '#b5651d', accentSecondary: '#2dd4bf' },
  },
  {
    id: 'executive-purple-bronze',
    label: 'Executive Purple Premium',
    description: 'Luxusní tmavě fialový motiv s bronzovými detaily pro vedení firmy.',
    preview: { background: '#150a1e', accent: '#9c6b30', accentSecondary: '#6b3fa0' },
  },
  {
    id: 'executive-gold-black-hex',
    label: 'Executive Gold Black',
    description: 'Ředitelský černo-zlatý motiv se šestiúhelníkovými statistickými panely.',
    preview: { background: '#0a0a0a', accent: '#c9a227', accentSecondary: '#6b6b6b' },
  },
  {
    id: 'enterprise-unified',
    label: 'Enterprise Dashboard',
    description: 'Jednotný černomodrý enterprise motiv se zlatými akcenty napříč celou aplikací.',
    preview: { background: '#0a0e12', accent: '#c9a227', accentSecondary: '#2f6fb0' },
  },
  {
    id: 'neon-crystal-tech',
    label: 'Neon Crystal Technology',
    description: 'Futuristický technologický motiv s neonově modrými a fialovými skleněnými kartami.',
    preview: { background: '#0a0e1a', accent: '#2dd4ff', accentSecondary: '#a855f7' },
  },
  {
    id: 'modern-office-professional',
    label: 'Modern Office Professional',
    description: 'Světlý kancelářský motiv s modrými a zelenými akcenty.',
    preview: { background: '#ffffff', accent: '#1976d2', accentSecondary: '#2e7d32' },
  },
  {
    id: 'modern-silver-3d',
    label: 'Modern Silver Office 3D',
    description: 'Prémiový světlý motiv s chromovým lemováním a plastickými 3D panely.',
    preview: { background: '#ffffff', accent: '#8fbf8f', accentSecondary: '#c9b3e0' },
  },
  {
    id: 'professional-office-green',
    label: 'Professional Office Green',
    description: 'Čistý bílý kancelářský motiv s hráškově zelenými akcenty.',
    preview: { background: '#ffffff', accent: '#5fa05f', accentSecondary: '#8a8a8a' },
  },
  {
    id: 'dark-elegance-premium',
    label: 'Dark Elegance Premium',
    description: 'Tmavý antracitový motiv s kovovými detaily a modrozelenými akcenty.',
    preview: { background: '#1a1d21', accent: '#3fb0a8', accentSecondary: '#9a9a9a' },
  },
  {
    id: 'crystal-office-folder',
    label: 'Crystal Office Folder',
    description: 'Světlý luxusní motiv s moduly ve tvaru 3D kancelářských složek.',
    preview: { background: '#ffffff', accent: '#2f8f7a', accentSecondary: '#3f7fd0' },
  },
  {
    id: 'office-crystal-double-square',
    label: 'Office Crystal Double Square',
    description: 'Čistý bílý motiv s dvojitými 3D čtvercovými boxy a modrými akcenty.',
    preview: { background: '#ffffff', accent: '#2f6fd0', accentSecondary: '#9a9a9a' },
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

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_VISUAL_THEME,
  isVisualThemeId,
  type VisualThemeId,
} from '@/constants/visualThemes'
import type { ThemeMode } from '@/types'

interface AccentColor {
  primary: string
  secondary: string
  glow: string
}

const NEON_GLASS_ACCENTS: AccentColor[] = [
  { primary: '#3b82f6', secondary: '#2563eb', glow: 'rgba(59, 130, 246, 0.35)' },
  { primary: '#06b6d4', secondary: '#0891b2', glow: 'rgba(6, 182, 212, 0.35)' },
  { primary: '#a855f7', secondary: '#9333ea', glow: 'rgba(168, 85, 247, 0.35)' },
  { primary: '#f59e0b', secondary: '#d97706', glow: 'rgba(245, 158, 11, 0.35)' },
  { primary: '#f43f5e', secondary: '#e11d48', glow: 'rgba(244, 63, 94, 0.35)' },
  { primary: '#10b981', secondary: '#059669', glow: 'rgba(16, 185, 129, 0.35)' },
]

const ACCENT_CYCLE_MS = 3000
const THEME_STORAGE_KEY = 'vh-theme'
const VISUAL_THEME_STORAGE_KEY = 'vh-visual-theme'

interface ThemeContextType {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  visualTheme: VisualThemeId
  setVisualTheme: (visualTheme: VisualThemeId) => void
  accentIndex: number
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function applyAccent(color: AccentColor) {
  const root = document.documentElement
  root.style.setProperty('--accent-primary', color.primary)
  root.style.setProperty('--accent-secondary', color.secondary)
  root.style.setProperty('--accent-glow', color.glow)
}

function clearAccentOverrides() {
  const root = document.documentElement
  root.style.removeProperty('--accent-primary')
  root.style.removeProperty('--accent-secondary')
  root.style.removeProperty('--accent-glow')
}

function applyThemeMode(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
}

function applyVisualTheme(visualTheme: VisualThemeId) {
  document.documentElement.setAttribute('data-visual-theme', visualTheme)
}

function readStoredThemeMode(fallback: ThemeMode): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'dark' || stored === 'light' ? stored : fallback
}

function readStoredVisualTheme(fallback: VisualThemeId): VisualThemeId {
  const stored = localStorage.getItem(VISUAL_THEME_STORAGE_KEY)
  return stored && isVisualThemeId(stored) ? stored : fallback
}

export function ThemeProvider({
  children,
  initialTheme = 'dark',
  initialVisualTheme = DEFAULT_VISUAL_THEME,
}: {
  children: ReactNode
  initialTheme?: ThemeMode
  initialVisualTheme?: VisualThemeId
}) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredThemeMode(initialTheme))
  const [visualTheme, setVisualThemeState] = useState<VisualThemeId>(() =>
    readStoredVisualTheme(initialVisualTheme)
  )
  const [accentIndex, setAccentIndex] = useState(0)

  useEffect(() => {
    applyThemeMode(theme)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    applyVisualTheme(visualTheme)
    localStorage.setItem(VISUAL_THEME_STORAGE_KEY, visualTheme)
  }, [visualTheme])

  useEffect(() => {
    if (visualTheme !== 'neon-glass') {
      clearAccentOverrides()
      return
    }

    applyAccent(NEON_GLASS_ACCENTS[accentIndex])
  }, [visualTheme, accentIndex])

  useEffect(() => {
    if (visualTheme !== 'neon-glass') {
      return
    }

    const interval = setInterval(() => {
      setAccentIndex((prev) => (prev + 1) % NEON_GLASS_ACCENTS.length)
    }, ACCENT_CYCLE_MS)

    return () => clearInterval(interval)
  }, [visualTheme])

  function setTheme(mode: ThemeMode) {
    setThemeState(mode)
  }

  function setVisualTheme(nextVisualTheme: VisualThemeId) {
    setVisualThemeState(nextVisualTheme)
    if (nextVisualTheme !== 'neon-glass') {
      setAccentIndex(0)
    }
  }

  function toggleTheme() {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme, visualTheme, setVisualTheme, accentIndex }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme musí být použit uvnitř ThemeProvider')
  }
  return context
}

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { AppDesign, ThemeMode } from '@/types'
import { normalizeAppDesign } from '@/constants/appDesign'
import {
  getStoredDeviceDesign,
  hasStoredDeviceDesign,
  setStoredDeviceDesign,
} from '@/lib/company/deviceDesign'

interface AccentColor {
  primary: string
  secondary: string
  glow: string
}

const ACCENT_PALETTE: AccentColor[] = [
  { primary: '#3b82f6', secondary: '#2563eb', glow: 'rgba(59, 130, 246, 0.35)' },
  { primary: '#06b6d4', secondary: '#0891b2', glow: 'rgba(6, 182, 212, 0.35)' },
  { primary: '#a855f7', secondary: '#9333ea', glow: 'rgba(168, 85, 247, 0.35)' },
  { primary: '#f59e0b', secondary: '#d97706', glow: 'rgba(245, 158, 11, 0.35)' },
  { primary: '#f43f5e', secondary: '#e11d48', glow: 'rgba(244, 63, 94, 0.35)' },
  { primary: '#10b981', secondary: '#059669', glow: 'rgba(16, 185, 129, 0.35)' },
]

const DESIGN_2_ACCENT: AccentColor = {
  primary: '#d4af37',
  secondary: '#2dd4bf',
  glow: 'rgba(212, 175, 55, 0.28)',
}

const DESIGN_3_ACCENT: AccentColor = {
  primary: '#b76e79',
  secondary: '#f3a3b1',
  glow: 'rgba(183, 110, 121, 0.35)',
}

const DESIGN_4_ACCENT: AccentColor = {
  primary: '#b87333',
  secondary: '#2dd4bf',
  glow: 'rgba(184, 115, 51, 0.35)',
}

const DESIGN_5_ACCENT: AccentColor = {
  primary: '#c9a227',
  secondary: '#f5d78e',
  glow: 'rgba(201, 162, 39, 0.35)',
}

const DESIGN_6_ACCENT: AccentColor = {
  primary: '#00A3FF',
  secondary: '#0057FF',
  glow: 'rgba(0, 163, 255, 0.22)',
}

const ACCENT_CYCLE_MS = 3000

interface SetAppDesignOptions {
  persistDevice?: boolean
}

interface ThemeContextType {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  accentIndex: number
  appDesign: AppDesign
  hasDeviceDesignOverride: boolean
  setAppDesign: (design: AppDesign, options?: SetAppDesignOptions) => void
  refreshDeviceDesignFlag: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function applyAccent(color: AccentColor) {
  const root = document.documentElement
  root.style.setProperty('--accent-primary', color.primary)
  root.style.setProperty('--accent-secondary', color.secondary)
  root.style.setProperty('--accent-glow', color.glow)
}

function applyThemeMode(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
}

function applyAppDesign(design: AppDesign) {
  document.documentElement.setAttribute('data-app-design', design)
}

function applyDesignAccent(design: AppDesign) {
  if (design === 'design_2') {
    applyAccent(DESIGN_2_ACCENT)
  } else if (design === 'design_3') {
    applyAccent(DESIGN_3_ACCENT)
  } else if (design === 'design_4') {
    applyAccent(DESIGN_4_ACCENT)
  } else if (design === 'design_5') {
    applyAccent(DESIGN_5_ACCENT)
  } else if (design === 'design_6') {
    applyAccent(DESIGN_6_ACCENT)
  }
}

export function ThemeProvider({
  children,
  initialTheme = 'dark',
  initialAppDesign = 'design_1',
}: {
  children: ReactNode
  initialTheme?: ThemeMode
  initialAppDesign?: AppDesign
}) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('vh-theme') as ThemeMode | null
    return stored ?? initialTheme
  })
  const [appDesign, setAppDesignState] = useState<AppDesign>(() => {
    const stored = getStoredDeviceDesign()
    return stored ?? normalizeAppDesign(initialAppDesign)
  })
  const [hasDeviceDesignOverride, setHasDeviceDesignOverride] = useState(() =>
    hasStoredDeviceDesign()
  )
  const [accentIndex, setAccentIndex] = useState(0)

  useEffect(() => {
    applyThemeMode(theme)
    localStorage.setItem('vh-theme', theme)
  }, [theme])

  useEffect(() => {
    const normalized = normalizeAppDesign(appDesign)
    applyAppDesign(normalized)
    applyDesignAccent(normalized)
  }, [appDesign])

  useEffect(() => {
    if (
      appDesign === 'design_2' ||
      appDesign === 'design_3' ||
      appDesign === 'design_4' ||
      appDesign === 'design_5' ||
      appDesign === 'design_6'
    ) {
      return
    }
    applyAccent(ACCENT_PALETTE[accentIndex])
  }, [accentIndex, appDesign])

  useEffect(() => {
    if (appDesign !== 'design_1') return

    const interval = setInterval(() => {
      setAccentIndex((prev) => (prev + 1) % ACCENT_PALETTE.length)
    }, ACCENT_CYCLE_MS)

    return () => clearInterval(interval)
  }, [appDesign])

  function setTheme(mode: ThemeMode) {
    setThemeState(mode)
  }

  function toggleTheme() {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  function refreshDeviceDesignFlag() {
    setHasDeviceDesignOverride(hasStoredDeviceDesign())
  }

  function setAppDesign(design: AppDesign, options?: SetAppDesignOptions) {
    const normalized = normalizeAppDesign(design)
    setAppDesignState(normalized)

    if (options?.persistDevice !== false) {
      setStoredDeviceDesign(normalized)
      setHasDeviceDesignOverride(true)
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        accentIndex,
        appDesign,
        hasDeviceDesignOverride,
        setAppDesign,
        refreshDeviceDesignFlag,
      }}
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

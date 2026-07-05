import {

  createContext,

  useContext,

  useEffect,

  useState,

  type ReactNode,

} from 'react'

import type { ThemeMode } from '@/types'



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



const ACCENT_CYCLE_MS = 3000



interface ThemeContextType {

  theme: ThemeMode

  setTheme: (theme: ThemeMode) => void

  toggleTheme: () => void

  accentIndex: number

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



export function ThemeProvider({

  children,

  initialTheme = 'dark',

}: {

  children: ReactNode

  initialTheme?: ThemeMode

}) {

  const [theme, setThemeState] = useState<ThemeMode>(() => {

    const stored = localStorage.getItem('vh-theme') as ThemeMode | null

    return stored ?? initialTheme

  })

  const [accentIndex, setAccentIndex] = useState(0)



  useEffect(() => {

    applyThemeMode(theme)

    localStorage.setItem('vh-theme', theme)

  }, [theme])



  useEffect(() => {

    applyAccent(ACCENT_PALETTE[accentIndex])

  }, [accentIndex])



  useEffect(() => {

    const interval = setInterval(() => {

      setAccentIndex((prev) => (prev + 1) % ACCENT_PALETTE.length)

    }, ACCENT_CYCLE_MS)



    return () => clearInterval(interval)

  }, [])



  function setTheme(mode: ThemeMode) {

    setThemeState(mode)

  }



  function toggleTheme() {

    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))

  }



  return (

    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, accentIndex }}>

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



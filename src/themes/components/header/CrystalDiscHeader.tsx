import { Menu, Bell, LogOut, Sun, Moon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { RoleBadge } from '@/components/ui/Badge'
import type { HeaderProps } from '@/themes/engine/types'

const discIconStyle: CSSProperties = {
  background:
    'conic-gradient(from 200deg, rgba(192,160,68,0.5), rgba(255,255,255,0.15) 25%, rgba(143,143,148,0.45) 50%, rgba(255,255,255,0.15) 75%, rgba(192,160,68,0.5))',
  boxShadow: '0 0 0 1px rgba(192,160,68,0.45) inset',
}

/**
 * Varianta 14 – Executive Crystal Disc – horní panel.
 *
 * Přihlašování/odhlašování, přepnutí motivu i profil uživatele používají
 * přesně stejné funkce (`useAuth`, `useTheme`) jako výchozí `Header` –
 * mění se jen vizuální podoba tlačítek (kruhové "disky" místo hranatých
 * ikon) a centrované logo v souladu s původním zadáním Varianty 14.
 */
export function CrystalDiscHeader({ title, onMenuClick, action }: HeaderProps) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b !rounded-none px-4 lg:px-6"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-glass)' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="touch-target rounded-full p-2 text-theme-secondary hover:bg-white/5 lg:hidden"
          aria-label="Otevřít menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {title ? <h1 className="truncate text-lg font-semibold text-theme-primary">{title}</h1> : null}
      </div>

      <div className="flex items-center gap-2">
        {action}

        <button
          onClick={toggleTheme}
          className="touch-target flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105"
          style={discIconStyle}
          aria-label={theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105"
          style={discIconStyle}
          aria-label="Oznámení"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="hidden items-center gap-3 border-l pl-3 sm:flex" style={{ borderColor: 'var(--border-glass)' }}>
          <div className="text-right">
            <p className="text-sm font-medium text-theme-primary">{profile?.full_name}</p>
            {profile && <RoleBadge role={profile.role} />}
          </div>
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-theme-secondary transition-transform hover:scale-105"
          style={discIconStyle}
          aria-label="Odhlásit se"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Odhlásit</span>
        </button>
      </div>
    </header>
  )
}

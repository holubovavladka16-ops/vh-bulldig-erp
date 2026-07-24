import { Menu, Bell, LogOut, Sun, Moon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Button } from '@/components/ui/Button'
import { RoleBadge } from '@/components/ui/Badge'

interface HeaderProps {
  title: string
  onMenuClick: () => void
  action?: ReactNode
}

export function Header({ title, onMenuClick, action }: HeaderProps) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border-glass)] glass-panel !rounded-none px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="touch-target rounded-xl p-2 text-theme-secondary hover:bg-white/5 lg:hidden"
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
          className="touch-target rounded-xl p-2 text-theme-secondary neon-border border-transparent transition-all hover:bg-white/5"
          aria-label={theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5 icon-neon" />
          ) : (
            <Moon className="h-5 w-5 icon-neon" />
          )}
        </button>

        <button
          className="relative rounded-xl p-2 text-theme-secondary neon-border border-transparent transition-all hover:bg-white/5"
          aria-label="Oznámení"
        >
          <Bell className="h-5 w-5" />
        </button>

        <div className="hidden items-center gap-3 border-l border-[var(--border-glass)] pl-3 sm:flex">
          <div className="text-right">
            <p className="text-sm font-medium text-theme-primary">{profile?.full_name}</p>
            {profile && <RoleBadge role={profile.role} />}
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={signOut} aria-label="Odhlásit se">
          <LogOut className="h-4 w-4 icon-neon" />
          <span className="hidden sm:inline">Odhlásit</span>
        </Button>
      </div>
    </header>
  )
}

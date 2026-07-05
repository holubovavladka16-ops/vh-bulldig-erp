import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface AppLayoutProps {
  title?: string
  children: ReactNode
  headerAction?: ReactNode
}

export function AppLayout({ title = '', children, headerAction }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-background flex min-h-dvh h-dvh overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
          action={headerAction}
        />

        <main className="flex-1 overflow-y-auto p-3 scrollbar-premium sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

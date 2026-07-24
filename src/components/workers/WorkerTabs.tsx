import { NavLink } from 'react-router-dom'
import type { WorkerTabId } from '@/types/workers'
import { WORKER_TABS } from '@/constants/workers'

interface WorkerTabsProps {
  workerId: string
  activeTab: WorkerTabId
}

export function WorkerTabs({ workerId, activeTab }: WorkerTabsProps) {
  return (
    <div className="mb-6 -mx-1 flex gap-2 overflow-x-auto border-b border-[var(--border-glass)] pb-4 scrollbar-premium">
      {WORKER_TABS.map((tab) => (
        <NavLink
          key={tab.id}
          to={`/delnici/${workerId}/${tab.id}`}
          className={({ isActive }) =>
            `shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 min-h-[44px] inline-flex items-center ${
              isActive || activeTab === tab.id
                ? 'nav-item-active text-accent'
                : 'text-theme-secondary hover:bg-white/5 neon-border border-transparent'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  )
}

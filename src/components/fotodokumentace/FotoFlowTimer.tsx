import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { FOTO_FLOW_BUDGET_MS } from '@/lib/fotodokumentace/geolocation'

interface FotoFlowTimerProps {
  active: boolean
  label?: string
}

export function FotoFlowTimer({ active, label = 'Celkový čas' }: FotoFlowTimerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) {
      setElapsed(0)
      return
    }
    const start = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - start), 100)
    return () => clearInterval(id)
  }, [active])

  if (!active) return null

  const seconds = (elapsed / 1000).toFixed(1)
  const budgetSec = FOTO_FLOW_BUDGET_MS / 1000
  const overBudget = elapsed > FOTO_FLOW_BUDGET_MS
  const pct = Math.min(100, (elapsed / FOTO_FLOW_BUDGET_MS) * 100)

  return (
    <div className="rounded-xl border border-[var(--border-glass)] bg-white/5 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1 text-theme-muted">
          <Clock className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className={overBudget ? 'font-medium text-amber-300' : 'text-theme-secondary'}>
          {seconds} s / {budgetSec} s
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${overBudget ? 'bg-amber-400' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

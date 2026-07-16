import { Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { DiaryPrefillWorker } from '@/types/diary'

interface DiaryWorkersBoxProps {
  workers: DiaryPrefillWorker[]
  workerCount: number
  loading?: boolean
}

export function DiaryWorkersBox({ workers, workerCount, loading }: DiaryWorkersBoxProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-elevated)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--accent-primary)]" />
          <div>
            <p className="font-medium text-theme-primary">Přítomní dělníci</p>
            <p className="text-xs text-theme-muted">Automaticky z docházky</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--accent-primary)]/15 px-3 py-1 text-sm font-semibold text-[var(--accent-primary)]">
            {loading ? '…' : workerCount}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-theme-muted" /> : <ChevronDown className="h-4 w-4 text-theme-muted" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border-glass)] px-4 py-3">
          {loading ? (
            <p className="text-sm text-theme-muted">Načítám…</p>
          ) : workers.length === 0 ? (
            <p className="text-sm text-amber-400">Pro tento den nejsou v docházce žádní dělníci na zakázce.</p>
          ) : (
            <ul className="space-y-1 text-sm text-theme-primary">
              {workers.map((w) => (
                <li key={w.id}>{w.full_name}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

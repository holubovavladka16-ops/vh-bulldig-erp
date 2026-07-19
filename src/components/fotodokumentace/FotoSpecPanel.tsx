import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'
import { FOTO_MODUL_PARAMETRY } from '@/constants/fotodokumentace'

export function FotoSpecPanel() {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-500/5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-theme-primary">
          <ClipboardList className="h-4 w-4 text-emerald-400" />
          Specifikace modulu – implementované parametry
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-theme-muted" /> : <ChevronDown className="h-4 w-4 text-theme-muted" />}
      </button>

      {open && (
        <div className="border-t border-emerald-500/15 px-4 pb-4 pt-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FOTO_MODUL_PARAMETRY.map((p) => (
              <div key={p.id} className="flex gap-2 rounded-lg bg-black/20 px-3 py-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-xs font-semibold text-theme-primary">{p.label}</p>
                  <p className="text-[11px] text-theme-muted">{p.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { WorkerPriceItem } from '@/types/workers'
import { PRICE_UNIT_LABELS, formatCurrency } from '@/constants/workers'

interface PriceItemPickerProps {
  label?: string
  items: WorkerPriceItem[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  /** Skryje cenu v řádcích (pro pohled dělníka, kde se cena nezobrazuje) */
  showPrice?: boolean
}

/**
 * Kompaktní, dvouřádkový výběr položky ceníku pro mobil.
 *
 * Nahrazuje nativní <select>: nativní roletka na mobilu (celoobrazovkový wheel picker na iOS,
 * velký modální seznam na Androidu) se nedá stylovat CSS a zobrazovala dlouhé jednořádkové
 * popisky bez odsazení. Tady je celý seznam vlastní, plně pod naší kontrolou.
 *
 * Formát řádku: název na prvním řádku (zkrácen třemi tečkami, pokud je moc dlouhý), jednotka a
 * cena na druhém řádku odděleně tečkou – např. "Kč/bm · 350 Kč".
 */
export function PriceItemPicker({
  label = 'Druh činnosti',
  items,
  value,
  onChange,
  disabled,
  showPrice = true,
}: PriceItemPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selected = items.find((i) => i.id === value) ?? items[0] ?? null

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function subtitle(item: WorkerPriceItem): string {
    const unit = PRICE_UNIT_LABELS[item.unit_type]
    return showPrice ? `${unit} · ${formatCurrency(item.price)}` : unit
  }

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      {label && (
        <p className="mb-1.5 block text-sm font-medium text-theme-secondary">{label}</p>
      )}

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="input-glass flex w-full min-w-0 items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="line-clamp-2 break-words text-sm font-medium leading-snug text-theme-primary">
                {selected.name}
              </span>
              <span className="block text-xs text-theme-muted">{subtitle(selected)}</span>
            </>
          ) : (
            <span className="text-sm text-theme-muted">Vyberte položku</span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-theme-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="glass-panel neon-border absolute inset-x-0 top-full z-30 mt-1 max-h-[45vh] overflow-y-auto rounded-xl p-1 shadow-xl"
        >
          {items.map((item) => {
            const isSelected = item.id === selected?.id
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(item.id)
                  setOpen(false)
                }}
                className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left transition ${
                  isSelected ? 'bg-[var(--accent-primary)]/15' : 'hover:bg-white/5'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 break-words text-sm font-medium leading-snug text-theme-primary">
                    {item.name}
                  </span>
                  <span className="block text-xs text-theme-muted">{subtitle(item)}</span>
                </span>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-accent" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

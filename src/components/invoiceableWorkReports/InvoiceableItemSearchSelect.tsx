import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { InvoiceableItem } from '@/types/invoiceableWorkReports'

interface InvoiceableItemSearchSelectProps {
  items: InvoiceableItem[]
  value: string
  onChange: (itemId: string) => void
  disabled?: boolean
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Automatické vyhledávání položky z ceníku – psaním se filtruje seznam, klikem se vybere. */
export function InvoiceableItemSearchSelect({ items, value, onChange, disabled }: InvoiceableItemSearchSelectProps) {
  const selected = items.find((i) => i.id === value) ?? null
  const [query, setQuery] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(selected?.name ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setQuery(selected?.name ?? '')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selected])

  const filtered =
    query.trim() === '' || query === selected?.name
      ? items
      : items.filter((i) => normalize(i.name).includes(normalize(query)))

  function handleSelect(item: InvoiceableItem) {
    onChange(item.id)
    setQuery(item.name)
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setQuery('')
    setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-theme-secondary">Položka *</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-muted" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery(selected?.name ?? '')
              e.currentTarget.blur()
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (value) onChange('')
          }}
          placeholder="Hledat položku…"
          className="input-glass w-full rounded-xl py-2.5 pl-9 pr-8 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary"
            aria-label="Vymazat výběr položky"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[var(--border-glass)] bg-[var(--bg-elevated)] shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-theme-muted">Žádná položka neodpovídá hledání.</li>
          ) : (
            filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${
                    item.id === value ? 'text-[var(--accent-primary)]' : 'text-theme-primary'
                  }`}
                >
                  {item.name}
                  {item.category && <span className="ml-2 text-xs text-theme-muted">{item.category}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

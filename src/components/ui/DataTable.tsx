import type { ReactNode } from 'react'

interface DataTableProps {
  columns: { key: string; label: string; className?: string }[]
  children: ReactNode
  emptyMessage?: string
  isEmpty?: boolean
}

export function DataTable({
  columns,
  children,
  emptyMessage = 'Žádná data k zobrazení',
  isEmpty = false,
}: DataTableProps) {
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl table-glass neon-border touch-pan-x [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[360px] text-left text-sm sm:min-w-[640px]">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-semibold text-theme-secondary ${col.className ?? ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {isEmpty && (
        <div className="px-4 py-12 text-center text-sm text-theme-muted">{emptyMessage}</div>
      )}
      </div>
      {!isEmpty && (
        <p className="table-scroll-hint md:hidden">Posuňte tabulku do stran pro zobrazení všech sloupců.</p>
      )}
    </div>
  )
}

interface DataTableRowProps {
  children: ReactNode
}

export function DataTableRow({ children }: DataTableRowProps) {
  return <tr>{children}</tr>
}

interface DataTableCellProps {
  children: ReactNode
  className?: string
}

export function DataTableCell({ children, className = '' }: DataTableCellProps) {
  return <td className={`px-4 py-3 text-theme-primary ${className}`}>{children}</td>
}

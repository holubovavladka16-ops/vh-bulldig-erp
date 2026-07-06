import { Card } from '@/components/ui/Card'
import { DataTable, DataTableCell, DataTableRow } from '@/components/ui/DataTable'
import type { WorkerPriceItem } from '@/types/workers'
import { PRICE_UNIT_LABELS, formatCurrency } from '@/constants/workers'

interface PortalPriceListCardProps {
  items: WorkerPriceItem[]
  loading?: boolean
}

export function PortalPriceListCard({ items, loading }: PortalPriceListCardProps) {
  const activeItems = items.filter((item) => item.is_active !== false)

  return (
    <Card>
      <h3 className="mb-2 text-base font-semibold text-theme-primary">Osobní ceník</h3>
      <p className="mb-4 text-sm text-theme-muted">
        Ceník se automaticky založí při registraci zaměstnance. Slouží pro výpočet výdělku v denním
        formuláři a pro evidenci docházky.
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Položka' },
            { key: 'unit', label: 'Jednotka' },
            { key: 'price', label: 'Cena' },
          ]}
          isEmpty={activeItems.length === 0}
          emptyMessage="Ceník zatím není nastaven. Kontaktujte administrátora."
        >
          {activeItems.map((item) => (
            <DataTableRow key={item.id}>
              <DataTableCell>{item.name}</DataTableCell>
              <DataTableCell>{PRICE_UNIT_LABELS[item.unit_type]}</DataTableCell>
              <DataTableCell>{formatCurrency(item.price)}</DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </Card>
  )
}

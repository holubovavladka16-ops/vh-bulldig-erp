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
        <>
          {/* Tablet/desktop: tabulka */}
          <div className="hidden md:block">
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
          </div>

          {/* Mobil: karty - celý název, celá jednotka, celá cena, žádné oříznutí ani scroll do stran */}
          <div className="space-y-2.5 md:hidden">
            {activeItems.length === 0 && (
              <div className="rounded-2xl table-glass neon-border px-4 py-8 text-center text-sm text-theme-muted">
                Ceník zatím není nastaven. Kontaktujte administrátora.
              </div>
            )}
            {activeItems.map((item) => (
              <div key={item.id} className="rounded-2xl table-glass neon-border p-3.5">
                <p className="break-words text-base font-semibold leading-snug text-theme-primary">
                  {item.name}
                </p>
                <p className="mt-1 text-sm text-theme-secondary">
                  Jednotka: <span className="text-theme-primary">{PRICE_UNIT_LABELS[item.unit_type]}</span>
                </p>
                <p className="text-sm text-theme-secondary">
                  Cena: <span className="font-medium text-theme-primary">{formatCurrency(item.price)}</span>
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

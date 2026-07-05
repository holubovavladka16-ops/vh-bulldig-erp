import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Plus, Printer } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { OrderInvoiceModal } from '@/components/profit/OrderInvoiceModal'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { fetchJobOrders } from '@/lib/orders/api'
import { createOrderInvoice, fetchProfitOverview } from '@/lib/profit/api'
import { exportProfitOverviewExcel, exportProfitOverviewPdf } from '@/lib/profit/export'
import { formatCurrency, formatDate } from '@/constants/workers'
import type { OrderProfitRow, ProfitOverviewFilters } from '@/types/profit'

function formatMargin(value: number | null): string {
  if (value == null) return '—'
  return `${value.toFixed(2)} %`
}

function profitClass(value: number): string {
  return value >= 0 ? 'text-emerald-400' : 'text-red-400'
}

function resultBadge(value: number): string {
  return value >= 0 ? '🟢 Zisk' : '🔴 Ztráta'
}

export function ProfitOverviewPage() {
  const { user } = useAuth()
  const { settings: company } = useCompanySettings()
  const [rows, setRows] = useState<OrderProfitRow[]>([])
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [filters, setFilters] = useState<ProfitOverviewFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)

  useEffect(() => {
    fetchJobOrders()
      .then((orders) => setOrderOptions(orders.map((o) => ({ value: o.id, label: o.name }))))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await fetchProfitOverview(filters))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení přehledu se nezdařilo')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        invoiced: acc.invoiced + row.invoiced_amount,
        costs: acc.costs + row.total_costs,
        profit: acc.profit + row.net_profit,
      }),
      { invoiced: 0, costs: 0, profit: 0 }
    )
  }, [rows])

  const periodLabel = [
    filters.dateFrom ? `od ${formatDate(filters.dateFrom)}` : null,
    filters.dateTo ? `do ${formatDate(filters.dateTo)}` : null,
    filters.orderId
      ? orderOptions.find((o) => o.value === filters.orderId)?.label ?? 'vybraná zakázka'
      : 'všechny zakázky',
  ]
    .filter(Boolean)
    .join(' · ')

  async function handleCreateInvoice(input: Parameters<typeof createOrderInvoice>[0]) {
    if (!user) return
    await createOrderInvoice(input, user.id)
    await load()
  }

  const filterOrderOptions = [{ value: '', label: 'Všechny zakázky' }, ...orderOptions]

  return (
    <AppLayout>
      <PageHeader
        title="Přehled hospodaření a zisku"
        description="Ekonomické výsledky jednotlivých zakázek – pouze pro administrátora."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setInvoiceModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Zadat fakturaci
            </Button>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={rows.length === 0}
              onClick={() => exportProfitOverviewPdf(rows, company, periodLabel)}
            >
              <Printer className="h-4 w-4" />
              Export PDF
            </Button>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={rows.length === 0}
              onClick={() => exportProfitOverviewExcel(rows)}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="Zakázka"
            options={filterOrderOptions}
            value={filters.orderId ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, orderId: e.target.value || undefined }))}
          />
          <Input
            label="Období od"
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))}
          />
          <Input
            label="Období do"
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value || undefined }))}
          />
        </div>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-theme-muted">Vyfakturováno celkem</p>
          <p className="mt-1 text-2xl font-bold text-theme-primary">{formatCurrency(totals.invoiced)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-theme-muted">Náklady celkem</p>
          <p className="mt-1 text-2xl font-bold text-theme-primary">{formatCurrency(totals.costs)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-theme-muted">Čistý zisk / ztráta</p>
          <p className={`mt-1 text-2xl font-bold ${profitClass(totals.profit)}`}>
            {formatCurrency(totals.profit)}
          </p>
        </Card>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'order', label: 'Zakázka' },
            { key: 'from', label: 'Období od' },
            { key: 'to', label: 'Období do' },
            { key: 'invoiced', label: 'Vyfakturováno', className: 'text-right' },
            { key: 'labor', label: 'Mzdy', className: 'text-right' },
            { key: 'advances', label: 'Zálohy', className: 'text-right' },
            { key: 'material', label: 'Materiál', className: 'text-right' },
            { key: 'tools', label: 'Nářadí', className: 'text-right' },
            { key: 'rental', label: 'Půjčovna', className: 'text-right' },
            { key: 'accommodation', label: 'Ubytování', className: 'text-right' },
            { key: 'fuel', label: 'PHM', className: 'text-right' },
            { key: 'tickets', label: 'Jízdenky', className: 'text-right' },
            { key: 'other', label: 'Ostatní', className: 'text-right' },
            { key: 'total', label: 'Náklady celkem', className: 'text-right' },
            { key: 'profit', label: 'Zisk / ztráta', className: 'text-right' },
            { key: 'margin', label: 'Marže', className: 'text-right' },
            { key: 'result', label: 'Výsledek' },
          ]}
          isEmpty={rows.length === 0}
          emptyMessage="Pro zadané filtry nejsou žádná data. Zadejte fakturaci nebo náklady na zakázku."
        >
          {rows.map((row) => (
            <DataTableRow key={row.order_id}>
              <DataTableCell className="min-w-[140px] font-medium">{row.order_name}</DataTableCell>
              <DataTableCell>{formatDate(row.period_from)}</DataTableCell>
              <DataTableCell>{formatDate(row.period_to)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.invoiced_amount)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.labor_costs)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.employee_advances)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.material_costs)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.tools_costs)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.rental_costs)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.accommodation_costs)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.fuel_costs)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.tickets_costs)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.other_costs)}</DataTableCell>
              <DataTableCell className="text-right font-medium">{formatCurrency(row.total_costs)}</DataTableCell>
              <DataTableCell className={`text-right font-semibold ${profitClass(row.net_profit)}`}>
                {formatCurrency(row.net_profit)}
              </DataTableCell>
              <DataTableCell className={`text-right ${profitClass(row.net_profit)}`}>
                {formatMargin(row.profit_margin)}
              </DataTableCell>
              <DataTableCell className="whitespace-nowrap">{resultBadge(row.net_profit)}</DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      <OrderInvoiceModal
        open={invoiceModalOpen}
        orderOptions={orderOptions}
        defaultOrderId={filters.orderId}
        onClose={() => setInvoiceModalOpen(false)}
        onSubmit={handleCreateInvoice}
      />
    </AppLayout>
  )
}

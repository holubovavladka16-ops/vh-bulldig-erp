import { useCallback, useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { PayrollFiltersPanel } from '@/components/payroll/PayrollFiltersPanel'
import { PayrollSlipDetailModal } from '@/components/payroll/PayrollSlipDetailModal'
import { fetchPayrollSummaries, getCurrentPayrollPeriod, getPayrollPeriod } from '@/lib/payroll/api'
import { fetchWorkers } from '@/lib/workers/api'
import type { PayrollFilters, PayrollSlipSummary } from '@/types/payroll'
import { formatCurrency } from '@/constants/workers'

export function PayrollModulePage() {
  const current = getCurrentPayrollPeriod()
  const [filters, setFilters] = useState<PayrollFilters>({
    year: current.year,
    month: current.month,
  })
  const [summaries, setSummaries] = useState<PayrollSlipSummary[]>([])
  const [workers, setWorkers] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSummaries(await fetchPayrollSummaries(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchWorkers('aktivni').then((list) =>
      setWorkers(list.map((w) => ({ id: w.id, label: `${w.last_name} ${w.first_name}` })))
    )
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  const period = getPayrollPeriod(filters.year, filters.month)

  return (
    <AppLayout>
      <PageHeader
        title="Výplatní pásky"
        description="Automaticky generované z výkazů zaměstnanců. Schválené výkazy tvoří výplatní pásku; čekající výkazy jsou viditelné ihned po odeslání formuláře."
      />

      <PayrollFiltersPanel filters={filters} onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))} workers={workers} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'worker', label: 'Zaměstnanec' },
            { key: 'reports', label: 'Schváleno' },
            { key: 'pending', label: 'Čeká' },
            { key: 'earnings', label: 'Celkový výdělek', className: 'text-right' },
            { key: 'advances', label: 'Zálohy', className: 'text-right' },
            { key: 'net', label: 'K výplatě', className: 'text-right' },
            { key: 'actions', label: 'Akce', className: 'text-right' },
          ]}
          isEmpty={summaries.length === 0}
          emptyMessage="V zadaném období nejsou schválené výkazy."
        >
          {summaries.map((row) => (
            <DataTableRow key={row.worker_id}>
              <DataTableCell>
                {row.worker_last_name} {row.worker_first_name}
              </DataTableCell>
              <DataTableCell>{row.report_count}</DataTableCell>
              <DataTableCell>
                {(row.pending_count ?? 0) > 0 ? (
                  <span className="text-amber-400">{row.pending_count}</span>
                ) : (
                  '—'
                )}
              </DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.total_earnings)}</DataTableCell>
              <DataTableCell className="text-right">{formatCurrency(row.total_advances)}</DataTableCell>
              <DataTableCell className="text-right font-semibold text-[var(--accent-primary)]">
                {formatCurrency(row.net_amount)}
              </DataTableCell>
              <DataTableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => setSelectedWorkerId(row.worker_id)}>
                  <Eye className="h-4 w-4" />
                  Otevřít
                </Button>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      {selectedWorkerId && (
        <PayrollSlipDetailModal
          workerId={selectedWorkerId}
          period={period}
          onClose={() => setSelectedWorkerId(null)}
        />
      )}
    </AppLayout>
  )
}

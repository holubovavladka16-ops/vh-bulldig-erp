import { useCallback, useEffect, useState } from 'react'
import { Eye, FileSpreadsheet } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { ModuleFilters } from '@/components/module5/ModuleFilters'
import { ReportDetailModal } from '@/components/module5/ReportDetailModal'
import { fetchAllReports, fetchDistinctOrders, type ModuleListFilters, type ReportListRecord } from '@/lib/workers/module5'
import { fetchWorkers } from '@/lib/workers/api'
import { downloadCsv } from '@/lib/export'
import { useAuth } from '@/context/AuthContext'
import { isAdministrator } from '@/constants/permissions'
import { WORKER_REPORT_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'

export function ReportsModulePage() {
  const { profile, user } = useAuth()
  const isAdmin = profile ? isAdministrator(profile.role) : false
  const [reports, setReports] = useState<ReportListRecord[]>([])
  const [workers, setWorkers] = useState<{ id: string; label: string }[]>([])
  const [orders, setOrders] = useState<{ id: string; label: string }[]>([])
  const [filters, setFilters] = useState<ModuleListFilters>({ sortBy: 'date', sortDir: 'desc' })
  const [loading, setLoading] = useState(true)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setReports(await fetchAllReports(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchWorkers('vse').then((list) =>
      setWorkers(list.map((w) => ({ id: w.id, label: `${w.last_name} ${w.first_name}` })))
    )
    fetchDistinctOrders().then(setOrders)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  function handleExport() {
    downloadCsv(
      'denni-vykazy.csv',
      ['Datum', 'Zaměstnanec', 'Zakázka', 'Výdělek', 'Záloha', 'Materiál', 'Stav'],
      reports.map((r) => [
        formatDate(r.report_date),
        `${r.worker_last_name} ${r.worker_first_name}`,
        r.order_name || '',
        formatCurrency(r.earnings),
        formatCurrency(r.advance ?? 0),
        r.material || '',
        WORKER_REPORT_STATUS_LABELS[r.status],
      ])
    )
  }

  return (
    <AppLayout>
      <PageHeader
        title="Denní výkazy"
        description="Automaticky vytvořené výkazy z odeslaných formulářů zaměstnanců."
        action={
          <Button variant="secondary" onClick={handleExport} disabled={reports.length === 0}>
            <FileSpreadsheet className="h-4 w-4" />
            Export do Excelu
          </Button>
        }
      />

      <ModuleFilters
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        workers={workers}
        orders={orders}
        showStatus
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'Datum' },
            { key: 'worker', label: 'Zaměstnanec' },
            { key: 'order', label: 'Zakázka' },
            { key: 'earnings', label: 'Výdělek' },
            { key: 'advance', label: 'Záloha' },
            { key: 'status', label: 'Stav' },
            { key: 'actions', label: 'Akce', className: 'text-right' },
          ]}
          isEmpty={reports.length === 0}
          emptyMessage="Žádné denní výkazy."
        >
          {reports.map((r) => (
            <DataTableRow key={r.id}>
              <DataTableCell>{formatDate(r.report_date)}</DataTableCell>
              <DataTableCell>{r.worker_last_name} {r.worker_first_name}</DataTableCell>
              <DataTableCell>{r.order_name || '—'}</DataTableCell>
              <DataTableCell>{formatCurrency(r.earnings)}</DataTableCell>
              <DataTableCell>{formatCurrency(r.advance ?? 0)}</DataTableCell>
              <DataTableCell>
                <StatusBadge
                  label={WORKER_REPORT_STATUS_LABELS[r.status]}
                  variant={r.status === 'schvaleny' ? 'success' : r.status === 'k_oprave' ? 'warning' : 'info'}
                />
              </DataTableCell>
              <DataTableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => setSelectedReportId(r.id)}>
                  <Eye className="h-4 w-4" />
                  Otevřít
                </Button>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      {selectedReportId && (
        <ReportDetailModal
          reportId={selectedReportId}
          isAdmin={isAdmin}
          userId={user?.id}
          onClose={() => setSelectedReportId(null)}
          onUpdated={load}
        />
      )}
    </AppLayout>
  )
}

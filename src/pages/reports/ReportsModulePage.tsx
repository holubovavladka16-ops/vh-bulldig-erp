import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, FileStack, Users } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ModuleFilters } from '@/components/module5/ModuleFilters'
import { ReportDetailModal } from '@/components/module5/ReportDetailModal'
import { WorkerReportsPanel } from '@/components/module5/WorkerReportsPanel'
import { fetchAllReports, fetchDistinctOrders, type ModuleListFilters, type ReportListRecord } from '@/lib/workers/module5'
import { fetchWorkers } from '@/lib/workers/api'
import { downloadCsv } from '@/lib/export'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { isAdministrator } from '@/constants/permissions'
import { WORKER_REPORT_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'

export function ReportsModulePage() {
  const { profile, user } = useAuth()
  const { settings: companySettings } = useCompanySettings()
  const isAdmin = profile ? isAdministrator(profile.role) : false
  const [reports, setReports] = useState<ReportListRecord[]>([])
  const [workers, setWorkers] = useState<{ id: string; label: string }[]>([])
  const [orders, setOrders] = useState<{ id: string; label: string }[]>([])
  const [filters, setFilters] = useState<ModuleListFilters>({ sortBy: 'date', sortDir: 'desc' })
  const [loading, setLoading] = useState(true)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }

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

  const selectedWorker = useMemo(
    () => workers.find((w) => w.id === filters.workerId),
    [workers, filters.workerId]
  )

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
        description="Přehled výkazů podle zaměstnance – zobrazení, PDF jednotlivě i hromadně."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/vykazy/papierove">
              <Button variant="secondary">
                <FileStack className="h-4 w-4" />
                Papírové formuláře
              </Button>
            </Link>
            <Button variant="secondary" onClick={handleExport} disabled={reports.length === 0}>
              <FileSpreadsheet className="h-4 w-4" />
              Export do Excelu
            </Button>
          </div>
        }
      />

      <ModuleFilters
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        workers={workers}
        orders={orders}
        showStatus
      />

      {!filters.workerId ? (
        <Card className="py-16 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-theme-muted" />
          <h2 className="text-lg font-semibold text-theme-primary">Vyberte zaměstnance</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-theme-secondary">
            Pro zobrazení kompletních výkazů dělníka zvolte jméno ve filtru Zaměstnanec. Zobrazí se všechny jeho záznamy včetně stažení PDF.
          </p>
        </Card>
      ) : (
        <WorkerReportsPanel
          reports={reports}
          workerLabel={selectedWorker?.label ?? 'Zaměstnanec'}
          workerLastName={reports[0]?.worker_last_name ?? selectedWorker?.label.split(' ')[0] ?? 'delnik'}
          company={company}
          loading={loading}
          onView={setSelectedReportId}
        />
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

import { useEffect, useState, useCallback } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { ReportDetailModal } from '@/components/module5/ReportDetailModal'
import { WorkerFormsAdmin } from '@/components/workers/WorkerFormsAdmin'
import { useAuth } from '@/context/AuthContext'
import { fetchReports } from '@/lib/workers/api'
import type { WorkerReport } from '@/types/workers'
import { WORKER_REPORT_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'

interface ReportsTabProps {
  workerId: string
  isAdmin: boolean
}

export function ReportsTab({ workerId, isAdmin }: ReportsTabProps) {
  const { user } = useAuth()
  const [reports, setReports] = useState<WorkerReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setReports(await fetchReports(workerId))
    setLoading(false)
  }, [workerId])

  useEffect(() => {
    load()
  }, [workerId, load])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isAdmin && <WorkerFormsAdmin workerId={workerId} isAdmin={isAdmin} />}

      <DataTable
        columns={[
          { key: 'date', label: 'Datum' },
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

      {selectedReportId && (
        <ReportDetailModal
          reportId={selectedReportId}
          isAdmin={isAdmin}
          userId={user?.id}
          onClose={() => setSelectedReportId(null)}
          onUpdated={load}
        />
      )}
    </div>
  )
}

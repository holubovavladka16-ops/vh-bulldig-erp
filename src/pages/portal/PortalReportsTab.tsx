import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ReportDetailView } from '@/components/module5/ReportDetailView'
import { portalGetReports } from '@/lib/workers/api'
import { portalGetReportDetail } from '@/lib/workers/module5'
import type { WorkerReport, ReportDetail } from '@/types/workers'
import { WORKER_REPORT_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'

interface PortalReportsTabProps {
  token: string
}

export function PortalReportsTab({ token }: PortalReportsTabProps) {
  const [reports, setReports] = useState<WorkerReport[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    portalGetReports(token).then(setReports).finally(() => setLoading(false))
  }, [token])

  async function openDetail(reportId: string) {
    setDetailLoading(true)
    try {
      setDetail(await portalGetReportDetail(token, reportId))
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  if (detail) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" size="sm" onClick={() => setDetail(null)}>
          Zpět na seznam
        </Button>
        <ReportDetailView detail={detail} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-theme-muted">
        Odeslané denní výkazy nelze upravovat ani mazat. Pro opravu kontaktujte administrátora.
      </p>
      <DataTable
        columns={[
          { key: 'date', label: 'Datum' },
          { key: 'order', label: 'Zakázka' },
          { key: 'earnings', label: 'Výdělek' },
          { key: 'advance', label: 'Záloha' },
          { key: 'status', label: 'Stav' },
          { key: 'actions', label: '', className: 'text-right' },
        ]}
        isEmpty={reports.length === 0}
        emptyMessage="Zatím nemáte žádné denní výkazy."
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
              <Button variant="ghost" size="sm" loading={detailLoading} onClick={() => openDetail(r.id)}>
                <Eye className="h-4 w-4" />
                Detail
              </Button>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { FieldModeCard } from '@/components/portal/field/FieldModeCard'
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--field-gold,#c9a227)]" />
      </div>
    )
  }

  if (detail) {
    return (
      <div className="space-y-4">
        <button type="button" className="field-mode-btn-secondary !w-auto px-4" onClick={() => setDetail(null)}>
          Zpět na seznam
        </button>
        <ReportDetailView detail={detail} />
      </div>
    )
  }

  return (
    <FieldModeCard title="Moje výkazy" icon="📋">
      <p className="mb-4 text-sm text-theme-muted">
        Odeslané denní výkazy nelze upravovat. Pro opravu kontaktujte administrátora.
      </p>

      {reports.length === 0 ? (
        <p className="text-sm text-theme-muted">Zatím nemáte žádné denní výkazy.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <button
              key={r.id}
              type="button"
              className="field-mode-history-item"
              disabled={detailLoading}
              onClick={() => void openDetail(r.id)}
            >
              <div>
                <p className="font-semibold text-theme-primary">{formatDate(r.report_date)}</p>
                <p className="text-sm text-theme-secondary">{r.order_name || '—'}</p>
                <p className="text-xs text-[var(--field-gold)]">
                  {formatCurrency(r.earnings)} · záloha {formatCurrency(r.advance ?? 0)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm text-theme-muted">
                {WORKER_REPORT_STATUS_LABELS[r.status]}
                <Eye className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      )}
    </FieldModeCard>
  )
}

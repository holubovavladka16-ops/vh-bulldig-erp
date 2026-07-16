import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, FileDown, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { MobilePdfPreviewModal } from '@/components/pdf/MobilePdfPreviewModal'
import { fetchReportDetail, type ReportListRecord } from '@/lib/workers/module5'
import {
  generateReportPdfBlob,
  generateReportsBulkPdfBlob,
  getReportPdfFilename,
  getReportsBulkPdfFilename,
} from '@/lib/workers/reportPdf'
import { downloadPdfBlob } from '@/lib/print/pdfShare'
import { isMobilePdfDevice } from '@/lib/print/mobileDetect'
import { formatTimeForInput } from '@/lib/workers/attendance'
import { WORKER_REPORT_STATUS_LABELS, formatCurrency, formatDate } from '@/constants/workers'
import type { CompanySettings } from '@/types'
import type { ReportDetail } from '@/types/workers'

interface WorkerReportsPanelProps {
  reports: ReportListRecord[]
  workerLabel: string
  workerLastName: string
  company: CompanySettings
  loading?: boolean
  onView: (reportId: string) => void
}

function formatReportPerformance(report: ReportListRecord): string {
  const parts: string[] = []
  if (report.hours > 0) parts.push(`${report.hours} hod`)
  if (report.meters > 0) parts.push(`${report.meters} bm`)
  if (report.pieces > 0) parts.push(`${report.pieces} ks`)
  if (report.activity?.trim()) parts.push(report.activity.trim())
  return parts.join(' · ') || '—'
}

function formatWorkTime(start?: string | null, end?: string | null): string {
  const from = start ? formatTimeForInput(start) : '—'
  const to = end ? formatTimeForInput(end) : '—'
  if (from === '—' && to === '—') return '—'
  return `${from} – ${to}`
}

export function WorkerReportsPanel({
  reports,
  workerLabel,
  workerLastName,
  company,
  loading = false,
  onView,
}: WorkerReportsPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [mobilePreview, setMobilePreview] = useState<{
    title: string
    fileName: string
    generate: () => Promise<Blob>
  } | null>(null)
  const mobilePdf = isMobilePdfDevice()

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => String(a.report_date).localeCompare(String(b.report_date), 'cs')),
    [reports]
  )

  const allSelected = reports.length > 0 && selectedIds.size === reports.length

  useEffect(() => {
    setSelectedIds(new Set())
  }, [reports])

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(reports.map((r) => r.id)))
    }
  }, [allSelected, reports])

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const fetchDetailsForIds = useCallback(
    async (ids: string[]): Promise<ReportDetail[]> => {
      const ordered = sortedReports.filter((r) => ids.includes(r.id))
      return Promise.all(ordered.map((r) => fetchReportDetail(r.id)))
    },
    [sortedReports]
  )

  const runBulkDownload = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      setPdfBusy(true)
      setPdfError('')
      try {
        const details = await fetchDetailsForIds(ids)
        const blob = await generateReportsBulkPdfBlob(details, company)
        downloadPdfBlob(blob, getReportsBulkPdfFilename(workerLastName, details.length))
      } catch (err) {
        setPdfError(err instanceof Error ? err.message : 'Stažení PDF se nezdařilo.')
      } finally {
        setPdfBusy(false)
      }
    },
    [company, fetchDetailsForIds, workerLastName]
  )

  const runSingleDownload = useCallback(
    async (reportId: string) => {
      setPdfBusy(true)
      setPdfError('')
      try {
        const detail = await fetchReportDetail(reportId)
        const fileName = getReportPdfFilename(detail)
        const title = `Denní výkaz – ${detail.worker.first_name} ${detail.worker.last_name}`

        if (mobilePdf) {
          setMobilePreview({
            title,
            fileName,
            generate: () => generateReportPdfBlob(detail, company),
          })
        } else {
          const blob = await generateReportPdfBlob(detail, company)
          downloadPdfBlob(blob, fileName)
        }
      } catch (err) {
        setPdfError(err instanceof Error ? err.message : 'Stažení PDF se nezdařilo.')
      } finally {
        setPdfBusy(false)
      }
    },
    [company, mobilePdf]
  )

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <Card className="py-12 text-center">
        <p className="text-theme-primary">Pro tohoto zaměstnance nejsou žádné výkazy.</p>
      </Card>
    )
  }

  return (
    <>
      <Card className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-theme-primary">{workerLabel}</h2>
            <p className="text-sm text-theme-secondary">
              {reports.length} {reports.length === 1 ? 'výkaz' : reports.length < 5 ? 'výkazy' : 'výkazů'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-glass)] px-3 py-2 text-sm text-theme-secondary">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-[var(--border-glass)]"
              />
              Vybrat vše
            </label>
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={pdfBusy}
              onClick={() => void runBulkDownload(reports.map((r) => r.id))}
            >
              <FileDown className="h-4 w-4" />
              Stáhnout všechny výkazy
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px]"
              disabled={pdfBusy || selectedIds.size === 0}
              onClick={() => void runBulkDownload([...selectedIds])}
            >
              <FileText className="h-4 w-4" />
              Stáhnout vybrané ({selectedIds.size})
            </Button>
          </div>
        </div>
        {pdfBusy && (
          <p className="text-sm text-theme-secondary">Generuji PDF…</p>
        )}
        {pdfError && <p className="text-sm text-red-400">{pdfError}</p>}
      </Card>

      <div className="hidden md:block">
        <DataTable
          columns={[
            { key: 'select', label: '', className: 'w-10' },
            { key: 'date', label: 'Datum' },
            { key: 'order', label: 'Zakázka' },
            { key: 'time', label: 'Práce' },
            { key: 'hours', label: 'Hodiny' },
            { key: 'perf', label: 'Výkony' },
            { key: 'earnings', label: 'Výdělek' },
            { key: 'advance', label: 'Záloha' },
            { key: 'status', label: 'Stav' },
            { key: 'actions', label: 'Akce', className: 'text-right' },
          ]}
          isEmpty={false}
        >
          {sortedReports.map((report) => (
            <DataTableRow key={report.id}>
              <DataTableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.has(report.id)}
                  onChange={() => toggleOne(report.id)}
                  className="h-4 w-4 rounded border-[var(--border-glass)]"
                  aria-label={`Vybrat výkaz ${formatDate(report.report_date)}`}
                />
              </DataTableCell>
              <DataTableCell>{formatDate(report.report_date)}</DataTableCell>
              <DataTableCell>{report.order_name || '—'}</DataTableCell>
              <DataTableCell>{formatWorkTime(report.form_work_start, report.form_work_end)}</DataTableCell>
              <DataTableCell>{report.hours > 0 ? `${report.hours} h` : '—'}</DataTableCell>
              <DataTableCell>{formatReportPerformance(report)}</DataTableCell>
              <DataTableCell>{formatCurrency(report.earnings)}</DataTableCell>
              <DataTableCell>{formatCurrency(report.advance ?? 0)}</DataTableCell>
              <DataTableCell>
                <StatusBadge
                  label={WORKER_REPORT_STATUS_LABELS[report.status]}
                  variant={report.status === 'schvaleny' ? 'success' : report.status === 'k_oprave' ? 'warning' : 'info'}
                />
              </DataTableCell>
              <DataTableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  <Button variant="ghost" size="sm" className="min-h-[40px]" onClick={() => onView(report.id)}>
                    <Eye className="h-4 w-4" />
                    Zobrazit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[40px]"
                    disabled={pdfBusy}
                    onClick={() => void runSingleDownload(report.id)}
                  >
                    <FileDown className="h-4 w-4" />
                    Stáhnout PDF
                  </Button>
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      </div>

      <div className="space-y-3 md:hidden">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-glass)] px-4 py-3">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-5 w-5 rounded border-[var(--border-glass)]"
          />
          <span className="font-medium text-theme-primary">Vybrat vše</span>
        </label>

        {sortedReports.map((report) => (
          <Card key={report.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <label className="flex shrink-0 cursor-pointer items-center pt-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(report.id)}
                  onChange={() => toggleOne(report.id)}
                  className="h-5 w-5 rounded border-[var(--border-glass)]"
                  aria-label={`Vybrat výkaz ${formatDate(report.report_date)}`}
                />
              </label>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-theme-primary">{formatDate(report.report_date)}</p>
                <p className="text-sm text-theme-secondary">{report.order_name || '—'}</p>
              </div>
              <StatusBadge
                label={WORKER_REPORT_STATUS_LABELS[report.status]}
                variant={report.status === 'schvaleny' ? 'success' : report.status === 'k_oprave' ? 'warning' : 'info'}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-theme-muted">Práce</p>
                <p className="text-theme-primary">{formatWorkTime(report.form_work_start, report.form_work_end)}</p>
              </div>
              <div>
                <p className="text-xs text-theme-muted">Hodiny</p>
                <p className="text-theme-primary">{report.hours > 0 ? `${report.hours} h` : '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-theme-muted">Výkony</p>
                <p className="text-theme-primary">{formatReportPerformance(report)}</p>
              </div>
              <div>
                <p className="text-xs text-theme-muted">Výdělek</p>
                <p className="font-medium text-theme-primary">{formatCurrency(report.earnings)}</p>
              </div>
              <div>
                <p className="text-xs text-theme-muted">Záloha</p>
                <p className="text-theme-primary">{formatCurrency(report.advance ?? 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant="secondary" className="min-h-[48px] w-full" onClick={() => onView(report.id)}>
                <Eye className="h-4 w-4" />
                Zobrazit
              </Button>
              <Button
                type="button"
                className="min-h-[48px] w-full"
                disabled={pdfBusy}
                onClick={() => void runSingleDownload(report.id)}
              >
                <FileDown className="h-4 w-4" />
                Stáhnout PDF
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {mobilePreview && (
        <MobilePdfPreviewModal
          title={mobilePreview.title}
          fileName={mobilePreview.fileName}
          onGenerate={mobilePreview.generate}
          onClose={() => setMobilePreview(null)}
        />
      )}
    </>
  )
}

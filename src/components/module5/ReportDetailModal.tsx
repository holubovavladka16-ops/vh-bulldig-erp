import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Check, RotateCcw, Trash2, Printer, FileSpreadsheet, Pencil, FileDown, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MobilePdfPreviewModal } from '@/components/pdf/MobilePdfPreviewModal'
import { ReportDetailView, buildReportPrintDocument } from '@/components/module5/ReportDetailView'
import {
  DailyFormFields,
  formStateFromWorkerForm,
  type DailyFormState,
} from '@/components/workers/DailyFormFields'
import {
  fetchReportDetail,
  approveDailyReport,
  returnDailyReport,
  deleteDailyReport,
} from '@/lib/workers/module5'
import { fetchJobOrderOptions } from '@/lib/orders/api'
import { filterTaskLinesForSave } from '@/lib/workers/earnings'
import {
  adminGetFormTaskItems,
  adminSaveForm,
  fetchPriceItems,
} from '@/lib/workers/api'
import { downloadCsv } from '@/lib/export'
import { openPrintDocument } from '@/lib/print/printDocument'
import { downloadPdfBlob } from '@/lib/print/pdfShare'
import { isMobilePdfDevice } from '@/lib/print/mobileDetect'
import { generateReportPdfBlob, getReportPdfFilename } from '@/lib/workers/reportPdf'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'
import type { ReportDetail, WorkerPriceItem } from '@/types/workers'
import { WORKER_REPORT_STATUS_LABELS, formatCurrency, formatDate, PRICE_UNIT_LABELS } from '@/constants/workers'

interface ReportDetailModalProps {
  reportId: string
  isAdmin: boolean
  userId?: string
  onClose: () => void
  onUpdated: () => void
  loadDetail?: (reportId: string) => Promise<ReportDetail>
}

export function ReportDetailModal({
  reportId,
  isAdmin,
  userId,
  onClose,
  onUpdated,
  loadDetail = fetchReportDetail,
}: ReportDetailModalProps) {
  const { settings: companySettings } = useCompanySettings()
  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }
  const mobilePdf = isMobilePdfDevice()
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editState, setEditState] = useState<DailyFormState | null>(null)
  const [priceItems, setPriceItems] = useState<WorkerPriceItem[]>([])
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    loadDetail(reportId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : 'Načtení se nezdařilo'))
      .finally(() => setLoading(false))
  }, [reportId, loadDetail])

  const generatePdf = useCallback(async () => {
    if (!detail) throw new Error('Výkaz není k dispozici.')
    return generateReportPdfBlob(detail, company)
  }, [detail, company])

  const pdfFileName = useMemo(
    () => (detail ? getReportPdfFilename(detail) : 'vykaz.pdf'),
    [detail]
  )

  const pdfTitle = useMemo(() => {
    if (!detail) return 'Denní výkaz'
    return `Denní výkaz – ${detail.worker.first_name} ${detail.worker.last_name}`
  }, [detail])

  async function handleDownloadPdf() {
    if (!detail) return
    if (mobilePdf) {
      setPdfPreviewOpen(true)
      return
    }
    setPdfBusy(true)
    try {
      const blob = await generateReportPdfBlob(detail, company)
      downloadPdfBlob(blob, getReportPdfFilename(detail))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stažení PDF se nezdařilo.')
    } finally {
      setPdfBusy(false)
    }
  }

  async function startEdit() {
    if (!detail?.report.form_id || !isAdmin) return
    const [tasks, items, orders] = await Promise.all([
      adminGetFormTaskItems(detail.report.form_id),
      fetchPriceItems(detail.report.worker_id),
      fetchJobOrderOptions(),
    ])
    if (!detail.form) return
    setPriceItems(items)
    setOrderOptions(orders)
    setEditState(
      formStateFromWorkerForm(
        detail.form,
        tasks.map((t) => ({ price_item_id: t.price_item_id, quantity: t.quantity }))
      )
    )
    setEditMode(true)
  }

  async function handleSaveEdit() {
    if (!detail?.report.form_id || !editState || !isAdmin) return
    setSaving(true)
    setError('')
    try {
      await adminSaveForm(detail.report.form_id, {
        form_date: editState.formDate,
        order_id: editState.orderId,
        work_type: editState.workType,
        work_description: editState.workDescription,
        work_start: editState.workStart,
        work_end: editState.workEnd,
        break_minutes: parseInt(editState.breakMinutes, 10) || 0,
        advance: parseFloat(editState.advance) || 0,
        material: editState.material,
        note: editState.note,
        gps_lat: editState.gpsLat,
        gps_lng: editState.gpsLng,
        gps_accuracy: editState.gpsAccuracy,
        signature_data: editState.signatureData,
        task_items: filterTaskLinesForSave(editState.taskLines, priceItems),
      })
      const refreshed = await loadDetail(reportId)
      setDetail(refreshed)
      setEditMode(false)
      setEditState(null)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove() {
    if (!userId || !isAdmin) return
    await approveDailyReport(reportId, userId)
    onUpdated()
    onClose()
  }

  async function handleReturn() {
    if (!userId || !isAdmin) return
    await returnDailyReport(reportId, userId)
    onUpdated()
    onClose()
  }

  async function handleDelete() {
    if (!isAdmin || !confirm('Smazat tento denní výkaz?')) return
    await deleteDailyReport(reportId)
    onUpdated()
    onClose()
  }

  function handlePrint() {
    if (!detail) return
    openPrintDocument(buildReportPrintDocument(detail, company))
  }

  function handleExportExcel() {
    if (!detail) return
    const headers = ['Datum', 'Zaměstnanec', 'Zakázka', 'Název práce', 'Množství', 'Jednotka', 'Cena', 'Celkem', 'Záloha', 'Výdělek', 'Materiál', 'Stav']
    const workerName = `${detail.worker.first_name} ${detail.worker.last_name}`
    const rows =
      detail.task_items.length > 0
        ? detail.task_items.map((item) => [
            formatDate(detail.report.report_date),
            workerName,
            detail.report.order_name,
            item.name,
            String(item.quantity),
            PRICE_UNIT_LABELS[item.unit_type],
            formatCurrency(item.price),
            formatCurrency(item.line_earnings),
            formatCurrency(detail.report.advance ?? 0),
            formatCurrency(detail.report.earnings),
            detail.report.material ?? '',
            WORKER_REPORT_STATUS_LABELS[detail.report.status],
          ])
        : [[
            formatDate(detail.report.report_date),
            workerName,
            detail.report.order_name,
            detail.report.activity,
            '',
            '',
            '',
            '',
            formatCurrency(detail.report.advance ?? 0),
            formatCurrency(detail.report.earnings),
            detail.report.material ?? '',
            WORKER_REPORT_STATUS_LABELS[detail.report.status],
          ]]

    downloadCsv(`vykaz-${detail.report.report_date}.csv`, headers, rows)
  }

  return (
    <>
      <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-xl glass-panel neon-border flex max-h-[100dvh] flex-col sm:max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-[var(--border-glass)] px-6 py-4">
          <h3 className="text-lg font-bold text-theme-primary">Denní výkaz</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-premium">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
            </div>
          )}
          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          {!loading && detail && !editMode && <ReportDetailView detail={detail} />}
          {!loading && editMode && editState && (
            <DailyFormFields
              state={editState}
              priceItems={priceItems}
              orderOptions={orderOptions}
              onChange={(patch) => setEditState((prev) => (prev ? { ...prev, ...patch } : prev))}
              isAdmin
              showEarnings
            />
          )}
        </div>

        {!loading && detail && (
          <div className="modal-footer flex flex-wrap gap-2 border-t border-[var(--border-glass)] px-4 py-4 sm:px-6">
            <Button variant="secondary" size="sm" className="min-h-[44px]" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Tisk / PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-[44px]"
              loading={pdfBusy}
              onClick={() => void handleDownloadPdf()}
            >
              {mobilePdf ? <FileText className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
              {mobilePdf ? 'PDF výkazu' : 'Stáhnout PDF'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              Export do Excelu
            </Button>
            {isAdmin && !editMode && detail.report.form_id && (
              <Button variant="secondary" size="sm" onClick={startEdit}>
                <Pencil className="h-4 w-4" />
                Upravit
              </Button>
            )}
            {isAdmin && editMode && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setEditMode(false)}>
                  Zrušit
                </Button>
                <Button size="sm" loading={saving} onClick={handleSaveEdit}>
                  Uložit změny
                </Button>
              </>
            )}
            {isAdmin && !editMode && detail.report.status !== 'schvaleny' && (
              <Button size="sm" onClick={handleApprove}>
                <Check className="h-4 w-4" />
                Schválit
              </Button>
            )}
            {isAdmin && !editMode && (
              <Button variant="secondary" size="sm" onClick={handleReturn}>
                <RotateCcw className="h-4 w-4" />
                Vrátit k opravě
              </Button>
            )}
            {isAdmin && !editMode && (
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
                Smazat
              </Button>
            )}
          </div>
        )}
      </div>
    </div>

      {pdfPreviewOpen && detail && (
        <MobilePdfPreviewModal
          title={pdfTitle}
          fileName={pdfFileName}
          onGenerate={generatePdf}
          onClose={() => setPdfPreviewOpen(false)}
        />
      )}
    </>
  )
}

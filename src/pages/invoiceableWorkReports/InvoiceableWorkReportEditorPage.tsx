import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  FileDown,
  Lock,
  LockOpen,
  Printer,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { InvoiceableReportStatusBadge } from '@/components/invoiceableWorkReports/InvoiceableReportStatusBadge'
import { InvoiceableAddLineForm } from '@/components/invoiceableWorkReports/InvoiceableAddLineForm'
import { InvoiceableLineTableRow } from '@/components/invoiceableWorkReports/InvoiceableLineTableRow'
import { InvoiceableOrderTotalsSummary } from '@/components/invoiceableWorkReports/InvoiceableOrderTotalsSummary'
import { InvoiceableHistorySection } from '@/components/invoiceableWorkReports/InvoiceableHistorySection'
import { InvoiceableConfirmDialog } from '@/components/invoiceableWorkReports/InvoiceableConfirmDialog'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import {
  addLine,
  closeReport,
  deleteLine,
  fetchActiveItems,
  fetchHistory,
  fetchOrderOptions,
  fetchReportDetail,
  reopenReport,
  updateLine,
  updateReportHeader,
} from '@/lib/invoiceableWorkReports/api'
import { downloadReportPdf } from '@/lib/invoiceableWorkReports/pdf'
import { previewReportDocument, printReportDocument } from '@/lib/invoiceableWorkReports/reportDocument'
import { useVirtualizedRows } from '@/lib/invoiceableWorkReports/useVirtualizedRows'
import { formatCurrency, formatDate } from '@/constants/workers'
import type {
  CreateInvoiceableLineInput,
  InvoiceableHistoryEntry,
  InvoiceableItem,
  InvoiceableWorkReportDetail,
  InvoiceableWorkReportLine,
  OrderOption,
  UpdateInvoiceableReportInput,
} from '@/types/invoiceableWorkReports'

type SortKey = 'work_date' | 'order_name' | 'item_name' | 'line_total'
type SortDirection = 'asc' | 'desc'

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'work_date', label: 'Datum' },
  { key: 'order_name', label: 'Zakázka' },
  { key: 'item_name', label: 'Položka' },
  { key: 'line_total', label: 'Celkem' },
]

type ConfirmAction =
  | { type: 'delete_line'; line: InvoiceableWorkReportLine }
  | { type: 'close' }
  | { type: 'reopen' }
  | null

/**
 * Editor jednoho fakturačního výkazu – hlavička, řádky s vlastní zakázkou
 * (inline editace, kopírování, řazení), průběžné součty podle zakázek,
 * PDF, historie změn a uzavření/znovuotevření výkazu.
 */
export function InvoiceableWorkReportEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { settings: companySettings } = useCompanySettings()

  const [report, setReport] = useState<InvoiceableWorkReportDetail | null>(null)
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [items, setItems] = useState<InvoiceableItem[]>([])
  const [history, setHistory] = useState<InvoiceableHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [pdfBusy, setPdfBusy] = useState<'preview' | 'download' | 'print' | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('work_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isClosed = report?.status === 'uzavreny'

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError('')
    try {
      const [detail, orderOptions, activeItems] = await Promise.all([
        fetchReportDetail(id),
        fetchOrderOptions(),
        fetchActiveItems(),
      ])
      if (!detail) {
        setLoadError('Výkaz nebyl nalezen.')
        return
      }
      setReport(detail)
      setOrders(orderOptions)
      setItems(activeItems)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Nepodařilo se načíst výkaz.')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadHistory = useCallback(async () => {
    if (!id) return
    setHistoryLoading(true)
    try {
      setHistory(await fetchHistory(id))
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
    void loadHistory()
  }, [load, loadHistory])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (saveStatus === 'saving') {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveStatus])

  function updateHeaderField(patch: Partial<UpdateInvoiceableReportInput>) {
    if (!report || isClosed) return
    const next: InvoiceableWorkReportDetail = { ...report, ...patch } as InvoiceableWorkReportDetail
    setReport(next)

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void persistHeader(next)
    }, 600)
  }

  async function persistHeader(next: InvoiceableWorkReportDetail) {
    if (!next.name.trim()) {
      setSaveStatus('error')
      setSaveError('Název výkazu je povinný.')
      return
    }
    if (next.period_to < next.period_from) {
      setSaveStatus('error')
      setSaveError('Datum „Období do“ nesmí být dřívější než „Období od“.')
      return
    }

    setSaveStatus('saving')
    setSaveError(null)
    try {
      await updateReportHeader(next.id, {
        name: next.name,
        period_from: next.period_from,
        period_to: next.period_to,
        note: next.note ?? '',
        customer_name: next.customer_name ?? '',
        contract_number: next.contract_number ?? '',
        purchase_order_number: next.purchase_order_number ?? '',
      })
      setSaveStatus('saved')
    } catch (err) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Uložení hlavičky selhalo.')
    }
  }

  const handleAddLine = useCallback(
    async (input: CreateInvoiceableLineInput) => {
      if (!report || !user) return
      const newLine = await addLine(report.id, input, user.id)
      setReport((prev) => (prev ? { ...prev, lines: [...prev.lines, newLine] } : prev))
      void loadHistory()
    },
    [report, user, loadHistory]
  )

  const handleSaveLine = useCallback(
    async (line: InvoiceableWorkReportLine, input: CreateInvoiceableLineInput) => {
      if (!user) return
      const updated = await updateLine(line.id, input, user.id, line)
      setReport((prev) => (prev ? { ...prev, lines: prev.lines.map((l) => (l.id === line.id ? updated : l)) } : prev))
      setEditingLineId(null)
      void loadHistory()
    },
    [user, loadHistory]
  )

  const handleDuplicateLine = useCallback(
    async (line: InvoiceableWorkReportLine) => {
      if (!report || !user) return
      setActionError('')
      try {
        const duplicated = await addLine(
          report.id,
          {
            order_id: line.order_id,
            work_date: line.work_date,
            item_id: line.item_id,
            item_name: line.item_name,
            item_category: line.item_category,
            unit: line.unit,
            quantity: line.quantity,
            unit_price: line.unit_price,
            note: line.note ?? undefined,
          },
          user.id
        )
        setReport((prev) => (prev ? { ...prev, lines: [...prev.lines, duplicated] } : prev))
        void loadHistory()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Kopírování řádku selhalo.')
      }
    },
    [report, user, loadHistory]
  )

  const requestDeleteLine = useCallback((line: InvoiceableWorkReportLine) => {
    setConfirmAction({ type: 'delete_line', line })
  }, [])

  const handleStartEdit = useCallback((lineId: string) => {
    setEditingLineId(lineId)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingLineId(null)
  }, [])

  async function handleConfirm() {
    if (!confirmAction || !report || !user) return
    setConfirmLoading(true)
    setActionError('')
    try {
      if (confirmAction.type === 'delete_line') {
        await deleteLine(confirmAction.line, user.id)
        setReport({ ...report, lines: report.lines.filter((l) => l.id !== confirmAction.line.id) })
        void loadHistory()
      } else if (confirmAction.type === 'close') {
        setClosing(true)
        await closeReport(report.id, user.id)
        await load()
        void loadHistory()
      } else if (confirmAction.type === 'reopen') {
        setClosing(true)
        await reopenReport(report.id, user.id)
        await load()
        void loadHistory()
      }
      setConfirmAction(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Akce se nezdařila.')
    } finally {
      setConfirmLoading(false)
      setClosing(false)
    }
  }

  async function handlePreviewPdf() {
    if (!report) return
    setPdfBusy('preview')
    setActionError('')
    try {
      previewReportDocument(report, companySettings)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Náhled PDF selhal.')
    } finally {
      setPdfBusy(null)
    }
  }

  async function handleDownloadPdf() {
    if (!report) return
    setPdfBusy('download')
    setActionError('')
    try {
      await downloadReportPdf(report, companySettings)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Stažení PDF selhalo.')
    } finally {
      setPdfBusy(null)
    }
  }

  async function handlePrintPdf() {
    if (!report) return
    setPdfBusy('print')
    setActionError('')
    try {
      printReportDocument(report, companySettings)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Tisk selhal.')
    } finally {
      setPdfBusy(null)
    }
  }

  function handleItemCreated(item: InvoiceableItem) {
    setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name, 'cs')))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const sortedLines = useMemo(() => {
    if (!report) return []
    const factor = sortDirection === 'asc' ? 1 : -1
    return [...report.lines].sort((a, b) => {
      if (sortKey === 'line_total') return (a.line_total - b.line_total) * factor
      const av = (sortKey === 'order_name' ? a.order_name : sortKey === 'item_name' ? a.item_name : a.work_date) ?? ''
      const bv = (sortKey === 'order_name' ? b.order_name : sortKey === 'item_name' ? b.item_name : b.work_date) ?? ''
      return av.localeCompare(bv, 'cs') * factor
    })
  }, [report, sortKey, sortDirection])

  const grandTotal = report ? report.lines.reduce((sum, l) => sum + l.line_total, 0) : 0

  const ROW_HEIGHT = 49
  const VIRTUAL_CONTAINER_HEIGHT = 480
  const virtual = useVirtualizedRows(
    editingLineId ? 0 : sortedLines.length,
    ROW_HEIGHT,
    VIRTUAL_CONTAINER_HEIGHT
  )
  const visibleLines = virtual.isVirtualized ? sortedLines.slice(virtual.startIndex, virtual.endIndex) : sortedLines

  if (loading) {
    return (
      <AppLayout title="Fakturační výkaz prací">
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      </AppLayout>
    )
  }

  if (loadError || !report) {
    return (
      <AppLayout title="Fakturační výkaz prací">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError || 'Výkaz nebyl nalezen.'}
        </div>
        <Link to="/fakturacni-vykaz" className="btn-neon mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium">
          <ArrowLeft className="h-4 w-4" />
          Zpět na přehled
        </Link>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Fakturační výkaz prací">
      <PageHeader
        title={report.name}
        description="Fakturační výkaz prací"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <InvoiceableReportStatusBadge status={report.status} />
            <Button variant="secondary" size="sm" onClick={handlePreviewPdf} loading={pdfBusy === 'preview'} aria-label="Náhled PDF">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownloadPdf} loading={pdfBusy === 'download'} aria-label="Stáhnout PDF">
              <FileDown className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handlePrintPdf} loading={pdfBusy === 'print'} aria-label="Vytisknout PDF">
              <Printer className="h-4 w-4" />
            </Button>
            {isClosed ? (
              <Button variant="secondary" onClick={() => setConfirmAction({ type: 'reopen' })} loading={closing}>
                <LockOpen className="h-4 w-4" />
                Znovu otevřít
              </Button>
            ) : (
              <Button onClick={() => setConfirmAction({ type: 'close' })} loading={closing} disabled={report.lines.length === 0}>
                <Lock className="h-4 w-4" />
                Uzavřít výkaz
              </Button>
            )}
          </div>
        }
      />

      <Link
        to="/fakturacni-vykaz"
        className="mb-2 inline-flex items-center gap-2 text-sm text-theme-muted hover:text-theme-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Zpět na přehled výkazů
      </Link>

      <p className="mb-4 text-xs text-theme-muted">
        Vytvořil: {report.creator_name ?? '—'} · Vytvořeno: {formatDate(report.created_at)} · Naposledy upraveno:{' '}
        {formatDate(report.updated_at)}
        {report.closed_at && (
          <>
            {' '}
            · Uzavřel: {report.closed_by_name ?? '—'} ({formatDate(report.closed_at)})
          </>
        )}
      </p>

      {actionError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {isClosed && (
        <div className="mb-4 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3 text-sm text-theme-secondary">
          Výkaz je uzavřený – řádky ani hlavičku nelze běžně upravovat. Součet za jednotlivé zakázky byl předán do
          Hospodaření a zisku.
        </div>
      )}

      {/* Formulář hlavičky výkazu */}
      <Card className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-theme-primary">Hlavička výkazu</h3>
          <AutoSaveIndicator status={saveStatus} errorMessage={saveError} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Název výkazu *"
            value={report.name}
            onChange={(e) => updateHeaderField({ name: e.target.value })}
            disabled={isClosed}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Období od *"
              type="date"
              value={report.period_from}
              onChange={(e) => updateHeaderField({ period_from: e.target.value })}
              disabled={isClosed}
            />
            <Input
              label="Období do *"
              type="date"
              value={report.period_to}
              onChange={(e) => updateHeaderField({ period_to: e.target.value })}
              disabled={isClosed}
            />
          </div>
          <Input
            label="Objednatel"
            value={report.customer_name ?? ''}
            onChange={(e) => updateHeaderField({ customer_name: e.target.value })}
            disabled={isClosed}
          />
          <Input
            label="Číslo smlouvy"
            value={report.contract_number ?? ''}
            onChange={(e) => updateHeaderField({ contract_number: e.target.value })}
            disabled={isClosed}
          />
          <Input
            label="Číslo objednávky"
            value={report.purchase_order_number ?? ''}
            onChange={(e) => updateHeaderField({ purchase_order_number: e.target.value })}
            disabled={isClosed}
          />
        </div>
        <Textarea
          label="Poznámka"
          value={report.note ?? ''}
          onChange={(e) => updateHeaderField({ note: e.target.value })}
          disabled={isClosed}
          rows={2}
        />
      </Card>

      {/* Tabulka položek */}
      <Card className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-theme-primary">Položky výkazu</h3>
          <div className="flex flex-wrap gap-1">
            <span className="mr-1 self-center text-xs text-theme-muted">Řadit podle:</span>
            {SORT_COLUMNS.map((col) => (
              <button
                key={col.key}
                type="button"
                onClick={() => toggleSort(col.key)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  sortKey === col.key
                    ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-glass)] text-theme-muted hover:text-theme-primary'
                }`}
              >
                {col.label}
                {sortKey === col.key &&
                  (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={virtual.isVirtualized ? virtual.containerRef : undefined}
          onScroll={virtual.isVirtualized ? virtual.onScroll : undefined}
          style={virtual.isVirtualized ? virtual.containerStyle : undefined}
        >
          <DataTable
            columns={[
              { key: 'date', label: 'Datum' },
              { key: 'order', label: 'Zakázka' },
              { key: 'item', label: 'Položka' },
              { key: 'unit', label: 'MJ' },
              { key: 'qty', label: 'Množství', className: 'text-right' },
              { key: 'price', label: 'Cena za MJ', className: 'text-right' },
              { key: 'total', label: 'Celkem', className: 'text-right' },
              { key: 'actions', label: 'Akce' },
            ]}
            isEmpty={sortedLines.length === 0}
            emptyMessage="Zatím nejsou přidané žádné řádky."
          >
            {virtual.isVirtualized && virtual.topSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td colSpan={8} style={{ height: virtual.topSpacerHeight, padding: 0, border: 0 }} />
              </tr>
            )}
            {visibleLines.map((line) => (
              <InvoiceableLineTableRow
                key={line.id}
                line={line}
                orders={orders}
                items={items}
                isEditing={editingLineId === line.id}
                editable={!isClosed}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onSave={handleSaveLine}
                onDuplicate={handleDuplicateLine}
                onDelete={requestDeleteLine}
              />
            ))}
            {virtual.isVirtualized && virtual.bottomSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td colSpan={8} style={{ height: virtual.bottomSpacerHeight, padding: 0, border: 0 }} />
              </tr>
            )}
            {sortedLines.length > 0 && (
              <DataTableRow>
                <DataTableCell className="font-semibold text-theme-primary">{''}</DataTableCell>
                <DataTableCell>{''}</DataTableCell>
                <DataTableCell>{''}</DataTableCell>
                <DataTableCell>{''}</DataTableCell>
                <DataTableCell>{''}</DataTableCell>
                <DataTableCell className="text-right font-semibold text-theme-primary">Celkem</DataTableCell>
                <DataTableCell className="text-right text-lg font-bold text-[var(--accent-primary)]">
                  {formatCurrency(grandTotal)}
                </DataTableCell>
                <DataTableCell>{''}</DataTableCell>
              </DataTableRow>
            )}
          </DataTable>
        </div>
        {virtual.isVirtualized && (
          <p className="text-xs text-theme-muted">
            Zobrazeno {visibleLines.length} z {sortedLines.length} řádků (plynulé posouvání pro velké výkazy).
          </p>
        )}

        {!isClosed && (
          <InvoiceableAddLineForm
            reportId={report.id}
            orders={orders}
            items={items}
            onItemCreated={handleItemCreated}
            onSubmit={handleAddLine}
          />
        )}
      </Card>

      {/* Průběžné součty podle zakázek */}
      <Card className="mb-6">
        <h3 className="mb-4 font-semibold text-theme-primary">Součty podle zakázek</h3>
        <InvoiceableOrderTotalsSummary lines={report.lines} />
      </Card>

      {/* Historie změn – pouze pro čtení */}
      <Card>
        <h3 className="mb-4 font-semibold text-theme-primary">Historie změn</h3>
        <InvoiceableHistorySection entries={history} loading={historyLoading} />
      </Card>

      {confirmAction && (
        <InvoiceableConfirmDialog
          title={
            confirmAction.type === 'delete_line'
              ? 'Smazat řádek'
              : confirmAction.type === 'close'
                ? 'Uzavřít výkaz'
                : 'Znovu otevřít výkaz'
          }
          message={
            confirmAction.type === 'delete_line'
              ? 'Opravdu chcete tento řádek smazat? Tuto akci nelze vrátit.'
              : confirmAction.type === 'close'
                ? 'Po uzavření nebude možné řádky běžně upravovat a součet za jednotlivé zakázky se předá do Hospodaření a zisku.'
                : 'Součty předané do Hospodaření se dočasně odstraní, dokud výkaz znovu neuzavřete.'
          }
          confirmLabel={confirmAction.type === 'delete_line' ? 'Smazat' : confirmAction.type === 'close' ? 'Uzavřít' : 'Znovu otevřít'}
          danger={confirmAction.type === 'delete_line'}
          loading={confirmLoading}
          onConfirm={handleConfirm}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </AppLayout>
  )
}

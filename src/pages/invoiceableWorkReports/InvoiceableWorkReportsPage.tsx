import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileDown, Lock, LockOpen, Plus, Trash2, X } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { InvoiceableReportStatusBadge } from '@/components/invoiceableWorkReports/InvoiceableReportStatusBadge'
import { InvoiceableConfirmDialog } from '@/components/invoiceableWorkReports/InvoiceableConfirmDialog'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import {
  closeReport,
  createReport,
  deleteReport,
  fetchOrderOptions,
  fetchReportDetail,
  fetchReports,
  reopenReport,
} from '@/lib/invoiceableWorkReports/api'
import { downloadReportPdf } from '@/lib/invoiceableWorkReports/pdf'
import { formatCurrency, formatDate } from '@/constants/workers'
import { todayIsoDate } from '@/lib/dates'
import type {
  InvoiceableReportStatus,
  InvoiceableWorkReportListItem,
  OrderOption,
} from '@/types/invoiceableWorkReports'

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Vše' },
  { value: 'rozpracovany', label: 'Rozpracovaný' },
  { value: 'uzavreny', label: 'Uzavřený' },
]

const EMPTY_FILTERS = { status: '' as InvoiceableReportStatus | '', orderId: '', dateFrom: '', dateTo: '' }

type ConfirmAction =
  | { type: 'delete'; report: InvoiceableWorkReportListItem }
  | { type: 'close'; report: InvoiceableWorkReportListItem }
  | { type: 'reopen'; report: InvoiceableWorkReportListItem }
  | null

/**
 * Fakturační výkaz prací – přehled všech výkazů, filtrování podle zakázky,
 * data a stavu, vytvoření nového výkazu, PDF a uzavření/znovuotevření.
 */
export function InvoiceableWorkReportsPage() {
  const { user } = useAuth()
  const { settings: companySettings } = useCompanySettings()
  const navigate = useNavigate()

  const [reports, setReports] = useState<InvoiceableWorkReportListItem[]>([])
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [error, setError] = useState('')

  const filtersActive = Object.values(filters).some(Boolean)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchReports({
        status: filters.status || undefined,
        orderId: filters.orderId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      })
      setReports(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst výkazy.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchOrderOptions().then(setOrders).catch(() => setOrders([]))
  }, [])

  useEffect(() => {
    const timeout = setTimeout(load, 200)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleNewReport() {
    if (!user) return
    setCreating(true)
    setError('')
    try {
      const report = await createReport(
        {
          name: `Výkaz ${formatDate(todayIsoDate())}`,
          period_from: todayIsoDate(),
          period_to: todayIsoDate(),
        },
        user.id
      )
      navigate(`/fakturacni-vykaz/${report.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření výkazu selhalo.')
    } finally {
      setCreating(false)
    }
  }

  async function handleCreatePdf(report: InvoiceableWorkReportListItem) {
    setPdfLoadingId(report.id)
    setError('')
    try {
      const detail = await fetchReportDetail(report.id)
      if (!detail) throw new Error('Výkaz nebyl nalezen.')
      await downloadReportPdf(detail, companySettings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření PDF selhalo.')
    } finally {
      setPdfLoadingId(null)
    }
  }

  async function handleConfirm() {
    if (!confirmAction || !user) return
    setConfirmLoading(true)
    setError('')
    try {
      if (confirmAction.type === 'delete') {
        await deleteReport(confirmAction.report.id)
      } else if (confirmAction.type === 'close') {
        await closeReport(confirmAction.report.id, user.id)
      } else if (confirmAction.type === 'reopen') {
        await reopenReport(confirmAction.report.id, user.id)
      }
      setConfirmAction(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Akce se nezdařila.')
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <AppLayout title="Fakturační výkaz prací">
      <PageHeader
        title="Fakturační výkaz prací"
        description="Evidence oceněných prací jako podklad pro Hospodaření a zisk."
        action={
          <Button onClick={handleNewReport} disabled={creating} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Nový fakturační výkaz
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          label="Stav"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as InvoiceableReportStatus | '' }))}
          options={STATUS_FILTER_OPTIONS}
        />
        <Select
          label="Zakázka"
          value={filters.orderId}
          onChange={(e) => setFilters((f) => ({ ...f, orderId: e.target.value }))}
          options={[{ value: '', label: 'Všechny zakázky' }, ...orders.map((o) => ({ value: o.id, label: o.name }))]}
        />
        <Input
          label="Datum od"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
        />
        <Input
          label="Datum do"
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
        />
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!filtersActive} className="w-full">
            <X className="h-4 w-4" />
            Vymazat filtry
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'name', label: 'Výkaz' },
            { key: 'period', label: 'Období' },
            { key: 'count', label: 'Položky' },
            { key: 'orders', label: 'Zakázky' },
            { key: 'total', label: 'Hodnota', className: 'text-right' },
            { key: 'status', label: 'Stav' },
            { key: 'author', label: 'Autor' },
            { key: 'created', label: 'Vytvořeno' },
            { key: 'updated', label: 'Upraveno' },
            { key: 'closed', label: 'Uzavřeno' },
            { key: 'actions', label: 'Akce' },
          ]}
          isEmpty={reports.length === 0}
          emptyMessage="Zatím žádné fakturační výkazy. Vytvořte první kliknutím na Nový fakturační výkaz."
        >
          {reports.map((report) => (
            <DataTableRow key={report.id}>
              <DataTableCell>
                <Link
                  to={`/fakturacni-vykaz/${report.id}`}
                  className="font-medium hover:text-accent hover:underline"
                >
                  {report.name}
                </Link>
                {report.customer_name && <div className="text-xs text-theme-muted">{report.customer_name}</div>}
              </DataTableCell>
              <DataTableCell>
                {formatDate(report.period_from)} – {formatDate(report.period_to)}
              </DataTableCell>
              <DataTableCell>{report.line_count}</DataTableCell>
              <DataTableCell>{report.order_count}</DataTableCell>
              <DataTableCell className="text-right font-medium">{formatCurrency(report.total_amount)}</DataTableCell>
              <DataTableCell>
                <InvoiceableReportStatusBadge status={report.status} />
              </DataTableCell>
              <DataTableCell>{report.creator_name ?? '—'}</DataTableCell>
              <DataTableCell>{formatDate(report.created_at)}</DataTableCell>
              <DataTableCell>{formatDate(report.updated_at)}</DataTableCell>
              <DataTableCell>{report.closed_at ? formatDate(report.closed_at) : '—'}</DataTableCell>
              <DataTableCell>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCreatePdf(report)}
                    disabled={pdfLoadingId === report.id}
                    aria-label="Vytvořit PDF"
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                  {report.status === 'rozpracovany' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmAction({ type: 'close', report })}
                      disabled={report.line_count === 0}
                      aria-label="Uzavřít výkaz"
                    >
                      <Lock className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmAction({ type: 'reopen', report })}
                      aria-label="Znovu otevřít výkaz"
                    >
                      <LockOpen className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => setConfirmAction({ type: 'delete', report })}
                    disabled={report.status === 'uzavreny'}
                    aria-label="Smazat výkaz"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      {confirmAction && (
        <InvoiceableConfirmDialog
          title={
            confirmAction.type === 'delete'
              ? 'Smazat výkaz'
              : confirmAction.type === 'close'
                ? 'Uzavřít výkaz'
                : 'Znovu otevřít výkaz'
          }
          message={
            confirmAction.type === 'delete'
              ? `Opravdu chcete smazat výkaz „${confirmAction.report.name}“? Tuto akci nelze vrátit.`
              : confirmAction.type === 'close'
                ? `Uzavřít výkaz „${confirmAction.report.name}“? Po uzavření nebude možné řádky běžně upravovat.`
                : `Znovu otevřít výkaz „${confirmAction.report.name}“? Součty předané do Hospodaření se dočasně odstraní.`
          }
          confirmLabel={confirmAction.type === 'delete' ? 'Smazat' : confirmAction.type === 'close' ? 'Uzavřít' : 'Znovu otevřít'}
          danger={confirmAction.type === 'delete'}
          loading={confirmLoading}
          onConfirm={handleConfirm}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </AppLayout>
  )
}

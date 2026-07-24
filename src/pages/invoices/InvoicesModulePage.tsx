import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, FileDown, Plus, Settings, Share2, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { InvoiceFiltersPanel } from '@/components/invoices/InvoiceFiltersPanel'
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge'
import { useAuth } from '@/context/AuthContext'
import { createDraftInvoice, deleteInvoice, fetchInvoice, fetchInvoiceSettings, fetchInvoices } from '@/lib/invoices/api'
import { downloadInvoicePdf, shareInvoicePdf } from '@/lib/invoices/pdf'
import { exportInvoicesExcel } from '@/lib/invoices/export'
import { printInvoiceReport } from '@/lib/invoices/invoiceReport'
import type { InvoiceFilters, IssuedInvoice } from '@/types/invoices'
import { formatCurrency, formatDate } from '@/constants/workers'

export function InvoicesModulePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [invoices, setInvoices] = useState<IssuedInvoice[]>([])
  const [filters, setFilters] = useState<InvoiceFilters>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setInvoices(await fetchInvoices(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleNewInvoice() {
    if (!user) return
    setCreating(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const draft = await createDraftInvoice(user.id)
      navigate(`/fakturace/${draft.id}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Vytvoření faktury selhalo')
    } finally {
      setCreating(false)
    }
  }

  async function handleQuickPdf(invoice: IssuedInvoice) {
    setActionError(null)
    setActionSuccess(null)
    try {
      const settings = await fetchInvoiceSettings()
      if (!settings) throw new Error('Nejdříve vyplňte Nastavení faktur')
      const full = await fetchInvoice(invoice.id)
      if (!full) return
      try {
        await downloadInvoicePdf(full, settings)
      } catch {
        printInvoiceReport(full, settings)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Vytvoření PDF selhalo')
    }
  }

  async function handleQuickShare(invoice: IssuedInvoice) {
    setActionError(null)
    setActionSuccess(null)
    try {
      const settings = await fetchInvoiceSettings()
      if (!settings) throw new Error('Nejdříve vyplňte Nastavení faktur')
      const full = await fetchInvoice(invoice.id)
      if (!full) return
      const result = await shareInvoicePdf(full, settings)
      if (result === 'downloaded') {
        setActionError('Sdílení není podporováno v tomto prohlížeči – PDF bylo staženo.')
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Sdílení PDF selhalo')
    }
  }

  async function handleDelete(invoice: IssuedInvoice) {
    if (
      !confirm('Opravdu chcete tuto fakturu smazat? Tuto akci nelze vrátit.')
    ) {
      return
    }

    setDeletingId(invoice.id)
    setActionError(null)
    setActionSuccess(null)
    try {
      await deleteInvoice(invoice.id)
      setActionSuccess('Faktura byla úspěšně smazána.')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Smazání faktury selhalo')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppLayout>
      <PageHeader
        title="Fakturovač"
        description="Vystavení faktur, historie, PDF ke stažení a sdílení."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link to="/nastaveni/faktury" className="btn-neon inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium sm:w-auto">
              <Settings className="h-4 w-4" />
              Nastavení faktur
            </Link>
            <Button onClick={handleNewInvoice} disabled={creating} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Nová faktura
            </Button>
          </div>
        }
      />

      {actionError ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{actionError}</div>
      ) : null}

      {actionSuccess ? (
        <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{actionSuccess}</div>
      ) : null}

      <InvoiceFiltersPanel filters={filters} onChange={setFilters} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={invoices.length === 0}
          onClick={() => exportInvoicesExcel(invoices)}
        >
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'number', label: 'Číslo faktury' },
            { key: 'date', label: 'Datum' },
            { key: 'customer', label: 'Odběratel' },
            { key: 'total', label: 'Cena', className: 'text-right' },
            { key: 'status', label: 'Stav' },
            { key: 'pdf', label: 'PDF' },
            { key: 'actions', label: 'Akce' },
          ]}
          isEmpty={invoices.length === 0}
          emptyMessage="Zatím žádné faktury. Vytvořte první kliknutím na Nová faktura."
        >
          {invoices.map((invoice) => (
            <DataTableRow key={invoice.id}>
              <DataTableCell>
                <Link to={`/fakturace/${invoice.id}`} className="font-medium hover:text-accent hover:underline">
                  {invoice.invoice_number}
                </Link>
              </DataTableCell>
              <DataTableCell>{formatDate(invoice.issue_date)}</DataTableCell>
              <DataTableCell>
                <div>{invoice.customer_name || '—'}</div>
                {invoice.customer_ico ? <div className="text-xs text-theme-muted">IČO {invoice.customer_ico}</div> : null}
              </DataTableCell>
              <DataTableCell className="text-right font-medium">{formatCurrency(invoice.total)}</DataTableCell>
              <DataTableCell>
                <InvoiceStatusBadge status={invoice.status} />
              </DataTableCell>
              <DataTableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleQuickPdf(invoice)} aria-label="Stáhnout PDF">
                    <FileDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleQuickShare(invoice)} aria-label="Sdílet PDF">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </DataTableCell>
              <DataTableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => handleDelete(invoice)}
                  disabled={deletingId === invoice.id}
                  aria-label="Smazat fakturu"
                >
                  <Trash2 className="h-4 w-4" />
                  Smazat
                </Button>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </AppLayout>
  )
}

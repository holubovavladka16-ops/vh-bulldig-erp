import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, FileDown, Mail, Plus, Settings } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { InvoiceFiltersPanel } from '@/components/invoices/InvoiceFiltersPanel'
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge'
import { useAuth } from '@/context/AuthContext'
import { createDraftInvoice, fetchInvoice, fetchInvoiceSettings, fetchInvoices } from '@/lib/invoices/api'
import { exportInvoicesExcel } from '@/lib/invoices/export'
import { printInvoiceReport } from '@/lib/invoices/invoiceReport'
import { getInvoiceEmailShareUrl } from '@/lib/invoices/share'
import type { InvoiceFilters, IssuedInvoice } from '@/types/invoices'
import { formatCurrency, formatDate } from '@/constants/workers'

export function InvoicesModulePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [invoices, setInvoices] = useState<IssuedInvoice[]>([])
  const [filters, setFilters] = useState<InvoiceFilters>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

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
    try {
      const draft = await createDraftInvoice(user.id)
      navigate(`/fakturace/${draft.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleQuickPdf(invoice: IssuedInvoice) {
    const settings = await fetchInvoiceSettings()
    if (!settings) return
    const full = await fetchInvoice(invoice.id)
    if (!full) return
    printInvoiceReport(full, settings)
  }

  function handleQuickEmail(invoice: IssuedInvoice) {
    window.location.href = getInvoiceEmailShareUrl(invoice, invoice.customer_email || undefined)
  }

  return (
    <AppLayout>
      <PageHeader
        title="Fakturovač"
        description="Kompletní fakturace VH Bulldig – vystavení, PDF, QR platba, historie a export."
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
            { key: 'total', label: 'Částka', className: 'text-right' },
            { key: 'vat', label: 'DPH', className: 'text-right' },
            { key: 'status', label: 'Stav' },
            { key: 'pdf', label: 'PDF' },
            { key: 'sent', label: 'Odesláno' },
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
              <DataTableCell className="text-right">{formatCurrency(invoice.vat_amount)}</DataTableCell>
              <DataTableCell>
                <InvoiceStatusBadge status={invoice.status} />
              </DataTableCell>
              <DataTableCell>
                <Button variant="ghost" size="sm" onClick={() => handleQuickPdf(invoice)}>
                  <FileDown className="h-4 w-4" />
                </Button>
              </DataTableCell>
              <DataTableCell>
                {invoice.sent_at ? (
                  <span className="text-xs text-theme-muted">{formatDate(invoice.sent_at.slice(0, 10))}</span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => handleQuickEmail(invoice)}>
                    <Mail className="h-4 w-4" />
                  </Button>
                )}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </AppLayout>
  )
}

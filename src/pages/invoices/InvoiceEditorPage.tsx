import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileDown, Loader2, Package, Save, Search, Share2, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { InvoiceLineItemsEditor } from '@/components/invoices/InvoiceLineItemsEditor'
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge'
import { lookupAresByIco } from '@/lib/invoices/ares'
import {
  deleteInvoice,
  fetchInvoice,
  fetchInvoiceSettings,
  updateInvoice,
} from '@/lib/invoices/api'
import { calculateInvoiceTotals } from '@/lib/invoices/calculations'
import { loadInvoiceLinesFromOrder } from '@/lib/invoices/orderLines'
import { downloadInvoicePdf, shareInvoicePdf } from '@/lib/invoices/pdf'
import { printInvoiceReport } from '@/lib/invoices/invoiceReport'
import { fetchJobOrders } from '@/lib/orders/api'
import {
  INVOICE_STATUS_LABELS,
  INVOICE_TEXT_PRESETS,
  type InvoiceLineInput,
  type InvoiceSettings,
  type IssuedInvoice,
  type IssuedInvoiceInput,
  type IssuedInvoiceStatus,
} from '@/types/invoices'
import { formatCurrency } from '@/constants/workers'

const STATUS_OPTIONS = (Object.entries(INVOICE_STATUS_LABELS) as [IssuedInvoiceStatus, string][]).map(
  ([value, label]) => ({ value, label })
)

const VAT_OPTIONS = [
  { value: 'none', label: 'Bez DPH' },
  { value: '21', label: '21 %' },
  { value: '12', label: '12 %' },
]

function invoiceToInput(invoice: IssuedInvoice): IssuedInvoiceInput {
  return {
    order_id: invoice.order_id,
    status: invoice.status,
    issue_date: invoice.issue_date,
    taxable_date: invoice.taxable_date,
    due_date: invoice.due_date,
    payment_method: invoice.payment_method,
    text_variant: invoice.text_variant,
    custom_text: invoice.custom_text,
    vat_mode: invoice.vat_mode,
    customer_name: invoice.customer_name,
    customer_ico: invoice.customer_ico,
    customer_dic: invoice.customer_dic,
    customer_address: invoice.customer_address,
    customer_city: invoice.customer_city,
    customer_postal_code: invoice.customer_postal_code,
    note: invoice.note ?? '',
    lines:
      invoice.lines?.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        vat_rate: line.vat_rate,
        source_type: line.source_type,
        source_id: line.source_id,
      })) ?? [],
  }
}

export function InvoiceEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [invoice, setInvoice] = useState<IssuedInvoice | null>(null)
  const [settings, setSettings] = useState<InvoiceSettings | null>(null)
  const [form, setForm] = useState<IssuedInvoiceInput | null>(null)
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aresLoading, setAresLoading] = useState(false)
  const [loadingOrderLines, setLoadingOrderLines] = useState(false)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfSharing, setPdfSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const lastAresIco = useRef('')

  const totals = useMemo(
    () => (form ? calculateInvoiceTotals(form.lines, form.vat_mode) : { subtotal: 0, vatAmount: 0, total: 0 }),
    [form]
  )

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [inv, invSettings, orders] = await Promise.all([
        fetchInvoice(id),
        fetchInvoiceSettings(),
        fetchJobOrders(),
      ])
      if (!inv) {
        setError('Faktura nebyla nalezena')
        return
      }
      setInvoice(inv)
      setSettings(invSettings)
      setForm(invoiceToInput(inv))
      setOrderOptions(orders.map((o) => ({ value: o.id, label: o.name })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení faktury se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  function patchForm(patch: Partial<IssuedInvoiceInput>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  function patchLines(lines: InvoiceLineInput[]) {
    patchForm({ lines })
  }

  const runAresLookup = useCallback(async (rawIco?: string) => {
    const ico = (rawIco ?? form?.customer_ico ?? '').replace(/\D/g, '')
    if (ico.length !== 8 || ico === lastAresIco.current) return
    setAresLoading(true)
    setError(null)
    try {
      const data = await lookupAresByIco(ico)
      lastAresIco.current = data.ico
      patchForm({
        customer_ico: data.ico,
        customer_name: data.name,
        customer_dic: data.dic,
        customer_address: data.address,
        customer_city: data.city,
        customer_postal_code: data.postal_code,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ARES lookup selhal')
    } finally {
      setAresLoading(false)
    }
  }, [form?.customer_ico])

  useEffect(() => {
    const ico = form?.customer_ico.replace(/\D/g, '') ?? ''
    if (ico.length !== 8) return
    const timeout = setTimeout(() => {
      void runAresLookup(ico)
    }, 700)
    return () => clearTimeout(timeout)
  }, [form?.customer_ico, runAresLookup])

  async function handleLoadOrderLines() {
    if (!form?.order_id) return
    setLoadingOrderLines(true)
    setError(null)
    try {
      const lines = await loadInvoiceLinesFromOrder(form.order_id)
      if (lines.length === 0) {
        setError('Zakázka neobsahuje položky k načtení')
        return
      }
      patchLines(lines)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení položek ze zakázky selhalo')
    } finally {
      setLoadingOrderLines(false)
    }
  }

  async function handleSave(nextStatus?: IssuedInvoiceStatus) {
    if (!form || !id) return
    setSaving(true)
    setError(null)
    try {
      const payload: IssuedInvoiceInput = {
        ...form,
        status: nextStatus ?? form.status ?? 'koncept',
        lines: form.lines.filter((line) => line.name.trim() || line.unit_price > 0),
      }
      if (payload.lines.length === 0) {
        payload.lines = [{ name: 'Položka', quantity: 1, unit: 'ks', unit_price: 0 }]
      }
      const updated = await updateInvoice(id, payload)
      setInvoice(updated)
      setForm(invoiceToInput(updated))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  async function handleFinalize() {
    await handleSave('vytvorena')
  }

  async function handlePdf() {
    if (!invoice || !settings) return
    setPdfGenerating(true)
    setError(null)
    try {
      const full = await fetchInvoice(invoice.id)
      if (!full) return
      await downloadInvoicePdf(full, settings)
    } catch (err) {
      const full = await fetchInvoice(invoice.id)
      if (full) printInvoiceReport(full, settings)
      else setError(err instanceof Error ? err.message : 'Vytvoření PDF selhalo')
    } finally {
      setPdfGenerating(false)
    }
  }

  async function handleSharePdf() {
    if (!invoice || !settings) return
    setPdfSharing(true)
    setError(null)
    setSuccess(null)
    try {
      const full = await fetchInvoice(invoice.id)
      if (!full) throw new Error('Faktura nebyla nalezena')
      const result = await shareInvoicePdf(full, settings)
      if (result === 'shared') {
        setSuccess('PDF bylo odesláno přes sdílení zařízení.')
      } else if (result === 'downloaded') {
        setSuccess('Sdílení není podporováno – PDF bylo staženo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sdílení PDF selhalo')
    } finally {
      setPdfSharing(false)
    }
  }

  async function handleDelete() {
    if (!invoice || !confirm('Trvale smazat tuto fakturu?')) return
    await deleteInvoice(invoice.id)
    navigate('/fakturace')
  }

  if (loading || !form || !invoice) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          {error ? (
            <div className="text-center">
              <p className="text-red-400">{error}</p>
              <Link to="/fakturace" className="btn-neon-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium">
                Zpět na seznam
              </Link>
            </div>
          ) : (
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
          )}
        </div>
      </AppLayout>
    )
  }

  const supplier = settings

  return (
    <AppLayout>
      <PageHeader
        title={`Faktura ${invoice.invoice_number}`}
        description={`Variabilní symbol: ${invoice.variable_symbol}`}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link to="/fakturace" className="btn-neon inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium">
              <ArrowLeft className="h-4 w-4" />
              Historie
            </Link>
            <Button variant="secondary" onClick={() => handleSave()} disabled={saving}>
              <Save className="h-4 w-4" />
              Uložit
            </Button>
            <Button onClick={handlePdf} disabled={pdfGenerating || pdfSharing}>
              <FileDown className="h-4 w-4" />
              {pdfGenerating ? 'Generuji PDF…' : 'Stáhnout PDF'}
            </Button>
            <Button variant="secondary" onClick={handleSharePdf} disabled={pdfGenerating || pdfSharing}>
              <Share2 className="h-4 w-4" />
              {pdfSharing ? 'Sdílím…' : 'Sdílet PDF'}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <InvoiceStatusBadge status={invoice.status} />
        <span className="text-sm text-theme-muted">VS: {invoice.variable_symbol}</span>
      </div>

      {error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
      {success ? <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</div> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-theme-primary">Dodavatel</h3>
          <div className="space-y-1 text-sm text-theme-secondary">
            <p className="font-medium text-theme-primary">{supplier?.company_name || '—'}</p>
            <p>{supplier?.ico ? `IČO: ${supplier.ico}` : ''}</p>
            <p>{supplier?.dic ? `DIČ: ${supplier.dic}` : ''}</p>
            <p>{[supplier?.address, supplier?.postal_code, supplier?.city].filter(Boolean).join(', ')}</p>
            <p>{supplier?.bank_account ? `Účet: ${supplier.bank_account}` : ''}</p>
          </div>
          <Link to="/nastaveni/faktury" className="mt-3 inline-flex text-sm text-accent hover:underline">
            Upravit v nastavení faktur
          </Link>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-theme-primary">Odběratel</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              label="IČO"
              value={form.customer_ico}
              onChange={(e) => {
                lastAresIco.current = ''
                patchForm({ customer_ico: e.target.value })
              }}
              placeholder="12345678"
              hint={aresLoading ? 'Načítám údaje z ARES…' : 'Po zadání 8 číslic se údaje doplní automaticky'}
            />
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={() => runAresLookup()} disabled={aresLoading}>
                {aresLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Načíst z ARES
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            <Input label="Název firmy" value={form.customer_name} readOnly />
            <Input label="DIČ" value={form.customer_dic ?? ''} readOnly />
            <Input label="Adresa" value={form.customer_address ?? ''} readOnly />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Město" value={form.customer_city ?? ''} readOnly />
              <Input label="PSČ" value={form.customer_postal_code ?? ''} readOnly />
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="mb-4 text-lg font-semibold text-theme-primary">Datumy a platba</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Datum vystavení"
            type="date"
            value={form.issue_date}
            onChange={(e) => patchForm({ issue_date: e.target.value })}
          />
          <Input
            label="Datum uskutečnění plnění"
            type="date"
            value={form.taxable_date ?? ''}
            onChange={(e) => patchForm({ taxable_date: e.target.value || null })}
          />
          <Input
            label="Datum splatnosti (volitelné)"
            type="date"
            value={form.due_date ?? ''}
            onChange={(e) => patchForm({ due_date: e.target.value || null })}
          />
          <Select
            label="Způsob platby"
            options={[
              { value: 'bankovni_prevod', label: 'Bankovní převod' },
              { value: 'hotovost', label: 'Hotovost' },
            ]}
            value={form.payment_method}
            onChange={(e) => patchForm({ payment_method: e.target.value as IssuedInvoiceInput['payment_method'] })}
          />
        </div>
      </Card>

      <Card className="mt-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-theme-primary">Zakázka a položky</h3>
            <p className="text-sm text-theme-muted">Volitelně propojte fakturu se zakázkou a načtěte položky.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              label="Zakázka"
              options={[{ value: '', label: 'Bez zakázky' }, ...orderOptions]}
              value={form.order_id ?? ''}
              onChange={(e) => patchForm({ order_id: e.target.value || null })}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!form.order_id || loadingOrderLines}
              onClick={handleLoadOrderLines}
              className="sm:mt-6"
            >
              {loadingOrderLines ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              Načíst položky ze zakázky
            </Button>
          </div>
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Select
            label="Text faktury"
            options={[
              { value: 'prace', label: INVOICE_TEXT_PRESETS.prace },
              { value: 'pripravne_prace', label: INVOICE_TEXT_PRESETS.pripravne_prace },
              { value: 'vlastni', label: 'Vlastní text' },
            ]}
            value={form.text_variant}
            onChange={(e) => patchForm({ text_variant: e.target.value as IssuedInvoiceInput['text_variant'] })}
          />
          <Select
            label="DPH"
            options={VAT_OPTIONS}
            value={form.vat_mode}
            onChange={(e) => {
              const vatMode = e.target.value as IssuedInvoiceInput['vat_mode']
              patchForm({
                vat_mode: vatMode,
                lines: form.lines.map((line) => ({
                  ...line,
                  vat_rate: vatMode === 'none' ? 0 : Number(vatMode),
                })),
              })
            }}
          />
        </div>

        {form.text_variant === 'vlastni' ? (
          <Textarea
            label="Vlastní text faktury"
            value={form.custom_text ?? ''}
            onChange={(e) => patchForm({ custom_text: e.target.value })}
            rows={3}
            className="mb-4"
          />
        ) : null}

        <InvoiceLineItemsEditor lines={form.lines} vatMode={form.vat_mode} onChange={patchLines} />

        <div className="mt-6 grid gap-2 rounded-xl border border-[var(--border-glass)] bg-black/10 p-4 text-sm sm:max-w-sm sm:ml-auto">
          <div className="flex justify-between">
            <span className="text-theme-muted">Celkem bez DPH</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-theme-muted">DPH</span>
            <span>{formatCurrency(totals.vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-[var(--border-glass)] pt-2 text-base font-semibold">
            <span>Celkem k úhradě</span>
            <span className="text-[var(--accent-primary)]">{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Stav faktury"
            options={STATUS_OPTIONS}
            value={form.status ?? 'koncept'}
            onChange={(e) => patchForm({ status: e.target.value as IssuedInvoiceStatus })}
          />
          <Textarea
            label="Interní poznámka"
            value={form.note ?? ''}
            onChange={(e) => patchForm({ note: e.target.value })}
            rows={3}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={handleFinalize} disabled={saving}>
            Označit jako vytvořenou
          </Button>
          <Button variant="ghost" onClick={handleDelete} className="text-red-400">
            <Trash2 className="h-4 w-4" />
            Smazat
          </Button>
        </div>
      </Card>
    </AppLayout>
  )
}

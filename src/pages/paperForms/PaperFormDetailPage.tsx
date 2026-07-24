import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Download, Printer } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { PaperFormDuplicateDialog } from '@/components/paperForms/PaperFormDuplicateDialog'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import {
  commitPaperMonthlyForm,
  createPaperMonthlyReplacementForm,
  fetchPaperForm,
  fetchPaperFormLines,
  printPaperMonthlyFormPdf,
  updatePaperFormLine,
  applyPaperFormAiImport,
  getPaperFormScanUrl,
  setPaperFormStatus,
} from '@/lib/paperForms/api'
import { PaperFormImportPanel } from '@/components/paperForms/PaperFormImportPanel'
import { fetchWorkers } from '@/lib/workers/api'
import { fetchJobOrders } from '@/lib/orders/api'
import { PAPER_FORM_STATUS_LABELS, PAPER_FORM_STATUS_VARIANT, formatPaperPeriod } from '@/constants/paperForms'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'
import type { PaperFormAiLine, PaperFormLine, PaperFormStatus, PaperMonthlyForm } from '@/types/paperForms'

type TabId = 'prehled' | 'tisk' | 'import' | 'revize' | 'archiv'

const TAB_IDS: TabId[] = ['prehled', 'tisk', 'import', 'revize', 'archiv']

function parseTabParam(value: string | null): TabId | null {
  if (!value) return null
  return TAB_IDS.includes(value as TabId) ? (value as TabId) : null
}

export function PaperFormDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { settings: companySettings } = useCompanySettings()
  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }

  const [form, setForm] = useState<PaperMonthlyForm | null>(null)
  const [lines, setLines] = useState<PaperFormLine[]>([])
  const [workers, setWorkers] = useState<{ value: string; label: string }[]>([])
  const [orders, setOrders] = useState<{ value: string; label: string; code: string }[]>([])
  const [tab, setTab] = useState<TabId>(() => {
    const raw = searchParams.get('tab')
    if (raw === 'priradit') return 'prehled'
    return parseTabParam(raw) ?? 'prehled'
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scanUrl, setScanUrl] = useState<string | null>(null)
  const [duplicateFormId, setDuplicateFormId] = useState<string | null>(null)
  const [duplicateFormNumber, setDuplicateFormNumber] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const [f, l] = await Promise.all([fetchPaperForm(id), fetchPaperFormLines(id)])
      setForm(f)
      setLines(l)
      if (f?.scanned_photo_path) {
        setScanUrl(await getPaperFormScanUrl(f.scanned_photo_path))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    fetchWorkers('aktivni').then((list) =>
      setWorkers(list.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` })))
    )
    fetchJobOrders({ status: 'aktivni' }).then((list) =>
      setOrders(
        list.map((o) => ({
          value: o.id,
          label: `${o.short_code ?? '—'} — ${o.name}`,
          code: o.short_code ?? '',
        }))
      )
    )
  }, [load])

  const attendanceLines = useMemo(
    () => lines.filter((l) => l.line_role === 'attendance_primary'),
    [lines]
  )

  async function openDuplicateDialog(existingFormId: string) {
    setDuplicateFormId(existingFormId)
    try {
      const existing = await fetchPaperForm(existingFormId)
      setDuplicateFormNumber(existing?.form_number ?? null)
    } catch {
      setDuplicateFormNumber(null)
    }
  }

  async function handlePrint() {
    if (!form) return
    setBusy(true)
    setError('')
    try {
      const printed = await printPaperMonthlyFormPdf(form.id, company)
      setForm(printed)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generování PDF se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateReplacementFromDuplicate() {
    if (!form || !form.worker_id || !duplicateFormId) return
    setBusy(true)
    setError('')
    try {
      const newFormId = await createPaperMonthlyReplacementForm(
        form.worker_id,
        form.month,
        form.year,
        user?.id ?? null
      )
      setDuplicateFormId(null)
      navigate(`/vykazy/papierove/${newFormId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření náhradního formuláře se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  async function handleImportOcrComplete(payload: {
    lines: PaperFormAiLine[]
    summary: Record<string, unknown>
    aiRaw: Record<string, unknown>
    confidence: number | null
    model: string
    scanPath: string
  }) {
    if (!form) return
    setBusy(true)
    setError('')
    try {
      await applyPaperFormAiImport(
        form.id,
        payload.lines,
        payload.summary,
        payload.aiRaw,
        payload.confidence,
        payload.model,
        payload.scanPath
      )
      await load()
      setTab('revize')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení OCR se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  async function handleStatusChange(status: PaperFormStatus) {
    if (!form) return
    setBusy(true)
    try {
      await setPaperFormStatus(form.id, status)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Změna stavu se nezdařila')
    } finally {
      setBusy(false)
    }
  }

  async function handleCommit() {
    if (!form || !user) return
    setBusy(true)
    setError('')
    try {
      await commitPaperMonthlyForm(form.id, user.id)
      await load()
      setTab('archiv')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Schválení importu se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  async function handleLinePatch(lineId: string, patch: Partial<PaperFormLine>) {
    await updatePaperFormLine(lineId, patch)
    await load()
  }

  if (loading) {
    return (
      <AppLayout>
        <Card className="py-12 text-center text-theme-secondary">Načítání formuláře…</Card>
      </AppLayout>
    )
  }

  if (!form) {
    return (
      <AppLayout>
        <Card className="py-12 text-center">
          <p className="text-theme-secondary">Formulář nenalezen.</p>
          <Link to="/vykazy/papierove" className="mt-4 inline-block text-accent">
            ← Zpět na seznam
          </Link>
        </Card>
      </AppLayout>
    )
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'prehled', label: 'Přehled' },
    { id: 'tisk', label: 'Tisk' },
    { id: 'import', label: 'Import' },
    { id: 'revize', label: 'Revize' },
    { id: 'archiv', label: 'Archiv' },
  ]

  return (
    <AppLayout>
      <div className="mb-4">
        <Link to="/vykazy/papierove" className="inline-flex items-center gap-1 text-sm text-theme-secondary hover:text-theme-primary">
          <ArrowLeft className="h-4 w-4" />
          Papírové měsíční výkazy
        </Link>
      </div>

      <PageHeader
        title={`Papírové měsíční výkazy · ${form.form_number}`}
        description={`${formatPaperPeriod(form.month, form.year)} · ID: ${form.form_number}`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge
          label={PAPER_FORM_STATUS_LABELS[form.status as PaperFormStatus]}
          variant={PAPER_FORM_STATUS_VARIANT[form.status as PaperFormStatus]}
        />
        {form.ai_confidence != null && (
          <StatusBadge label={`OCR ${Math.round(form.ai_confidence)} %`} variant="info" />
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-[var(--border-glass)] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.id ? 'bg-accent/20 text-accent' : 'text-theme-secondary hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {tab === 'prehled' && (
        <Card className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <p><span className="text-theme-muted">Zaměstnanec:</span> {form.worker_snapshot ? `${form.worker_snapshot.first_name} ${form.worker_snapshot.last_name}` : '— (při prvním QR)'}</p>
            <p><span className="text-theme-muted">Dní:</span> {attendanceLines.length}</p>
            <p><span className="text-theme-muted">OCR:</span> {form.imported_at ? new Date(form.imported_at).toLocaleString('cs-CZ') : '—'}</p>
            <p><span className="text-theme-muted">Schváleno:</span> {form.approved_at ? new Date(form.approved_at).toLocaleString('cs-CZ') : '—'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void handleStatusChange('distributed')}>Rozdané</Button>
            <Button variant="secondary" size="sm" onClick={() => void handleStatusChange('returned')}>Vrácené</Button>
          </div>
        </Card>
      )}

      {tab === 'tisk' && (
        <Card>
          <p className="mb-4 text-sm text-theme-secondary">
            Černobílý jednostránkový A4 formulář — sloupce: Den, Datum, Zakázka, Od, Do, Celkem hodin, Ruční výkop hloubka 50–70 cm (bm), Průraz do objektu (ks), Záloha (Kč), Podpis. QR vpravo dole.
          </p>
          <Button onClick={handlePrint} loading={busy}>
            <Printer className="h-4 w-4" />
            Stáhnout / Tisknout PDF
          </Button>
        </Card>
      )}

      {tab === 'import' && (
        <PaperFormImportPanel
          form={form}
          workers={workers}
          onAssigned={load}
          onDuplicateActiveForm={(existingFormId) => void openDuplicateDialog(existingFormId)}
          onOcrComplete={(payload) => void handleImportOcrComplete(payload)}
        />
      )}

      {tab === 'revize' && (
        <div className="space-y-4">
          {scanUrl && (
            <Card>
              <p className="mb-2 text-sm text-theme-muted">Naskenovaný formulář</p>
              <img src={scanUrl} alt="Scan" className="max-h-64 rounded border border-[var(--border-glass)]" />
            </Card>
          )}

          <Card className="overflow-x-auto">
            <h3 className="mb-3 font-medium text-theme-primary">Docházka po dnech — každý den vlastní zakázka</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-theme-muted">
                  <th className="p-2">Datum</th>
                  <th className="p-2">Zakázka</th>
                  <th className="p-2">Od</th>
                  <th className="p-2">Do</th>
                  <th className="p-2">Hodiny</th>
                  <th className="p-2">Výkop bm</th>
                  <th className="p-2">Průraz ks</th>
                  <th className="p-2">Záloha Kč</th>
                  <th className="p-2">OCR %</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLines.map((line) => (
                  <tr key={line.id} className="border-t border-[var(--border-glass)]">
                    <td className="p-2 whitespace-nowrap">{line.form_date}</td>
                    <td className="p-2">
                      <input
                        className="mb-1 w-20 rounded border border-[var(--border-glass)] bg-white/5 px-1 py-0.5 text-xs"
                        placeholder="BRN-024"
                        defaultValue={line.order_code ?? ''}
                        onBlur={(e) => {
                          const code = e.target.value.trim()
                          const order = orders.find((o) => o.code.toUpperCase() === code.toUpperCase())
                          void handleLinePatch(line.id, { order_code: code || null, order_id: order?.value ?? null })
                        }}
                      />
                      <select
                        className="block max-w-[140px] rounded border border-[var(--border-glass)] bg-white/5 px-1 py-0.5 text-xs"
                        value={line.order_id ?? ''}
                        onChange={(e) => {
                          const order = orders.find((o) => o.value === e.target.value)
                          void handleLinePatch(line.id, { order_id: e.target.value || null, order_code: order?.code ?? line.order_code })
                        }}
                      >
                        <option value="">—</option>
                        {orders.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input className="w-16 rounded border border-[var(--border-glass)] bg-white/5 px-1 py-0.5" defaultValue={line.work_start?.slice(0, 5) ?? ''} onBlur={(e) => void handleLinePatch(line.id, { work_start: e.target.value || null })} />
                    </td>
                    <td className="p-2">
                      <input className="w-16 rounded border border-[var(--border-glass)] bg-white/5 px-1 py-0.5" defaultValue={line.work_end?.slice(0, 5) ?? ''} onBlur={(e) => void handleLinePatch(line.id, { work_end: e.target.value || null })} />
                    </td>
                    <td className="p-2">
                      <input type="number" className="w-14 rounded border border-[var(--border-glass)] bg-white/5 px-1 py-0.5" defaultValue={line.performance_hours ?? ''} onBlur={(e) => void handleLinePatch(line.id, { performance_hours: e.target.value ? Number(e.target.value) : null })} />
                    </td>
                    <td className="p-2">
                      <input type="number" className="w-14 rounded border border-[var(--border-glass)] bg-white/5 px-1 py-0.5" defaultValue={line.manual_dig_bm ?? ''} onBlur={(e) => void handleLinePatch(line.id, { manual_dig_bm: e.target.value ? Number(e.target.value) : null })} />
                    </td>
                    <td className="p-2">
                      <input type="number" className="w-14 rounded border border-[var(--border-glass)] bg-white/5 px-1 py-0.5" defaultValue={line.penetration_ks ?? ''} onBlur={(e) => void handleLinePatch(line.id, { penetration_ks: e.target.value ? Number(e.target.value) : null })} />
                    </td>
                    <td className="p-2">
                      <input type="number" className="w-14 rounded border border-[var(--border-glass)] bg-white/5 px-1 py-0.5" defaultValue={line.daily_advance ?? 0} onBlur={(e) => void handleLinePatch(line.id, { daily_advance: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="p-2">{line.ai_confidence != null ? Math.round(line.ai_confidence) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {form.status !== 'archived' && form.status !== 'approved' && (
            <Button onClick={handleCommit} loading={busy}>
              <Check className="h-4 w-4" />
              Schválit a importovat do ERP (docházka, výkazy, mzdy)
            </Button>
          )}
        </div>
      )}

      {tab === 'archiv' && (
        <Card className="space-y-4">
          {scanUrl && (
            <div>
              <p className="mb-2 text-sm text-theme-muted">Originální scan</p>
              <img src={scanUrl} alt="Scan formuláře" className="max-h-96 rounded-lg border border-[var(--border-glass)]" />
            </div>
          )}
          <div className="grid gap-2 text-sm">
            <p><span className="text-theme-muted">OCR:</span> {form.imported_at ? new Date(form.imported_at).toLocaleString('cs-CZ') : '—'}</p>
            <p><span className="text-theme-muted">Model:</span> {form.ai_model ?? '—'}</p>
            <p><span className="text-theme-muted">Jistota:</span> {form.ai_confidence != null ? `${Math.round(form.ai_confidence)} %` : '—'}</p>
          </div>
          <Button variant="secondary" onClick={() => void handlePrint()} loading={busy}>
            <Download className="h-4 w-4" />
            Stáhnout PDF formuláře
          </Button>
        </Card>
      )}

      <PaperFormDuplicateDialog
        open={Boolean(duplicateFormId)}
        formNumber={duplicateFormNumber}
        loading={busy}
        onOpenExisting={() => {
          if (duplicateFormId) navigate(`/vykazy/papierove/${duplicateFormId}`)
        }}
        onReprint={() => {
          if (duplicateFormId) void printPaperMonthlyFormPdf(duplicateFormId, company).then(() => setDuplicateFormId(null))
        }}
        onCreateReplacement={() => void handleCreateReplacementFromDuplicate()}
        onCancel={() => setDuplicateFormId(null)}
      />
    </AppLayout>
  )
}

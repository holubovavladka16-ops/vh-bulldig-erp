import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, FileStack, Printer, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/Badge'
import { PaperFormDuplicateDialog } from '@/components/paperForms/PaperFormDuplicateDialog'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { useAuth } from '@/context/AuthContext'
import {
  cancelPaperMonthlyForm,
  createPaperMonthlyFormForWorker,
  createPaperMonthlyFormReplacement,
  fetchPaperForm,
  fetchPaperFormLines,
  fetchWorkerActivePaperForm,
  markPaperFormPrinted,
  parseDuplicatePaperFormError,
  type WorkerActivePaperForm,
} from '@/lib/paperForms/api'
import { buildPaperMonthlyFormPdfBlob, getPaperFormPdfFilename } from '@/lib/paperForms/pdf'
import { downloadPdfBlob } from '@/lib/print/pdfShare'
import {
  MONTH_NAMES,
  WORKER_PAPER_FORM_STATUS,
  formatPaperPeriod,
  mapWorkerPaperFormStatus,
} from '@/constants/paperForms'
import type { PaperFormStatus } from '@/types/paperForms'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'

interface PaperFormWorkerCardProps {
  workerId: string
  isAdmin: boolean
}

export function PaperFormWorkerCard({ workerId, isAdmin }: PaperFormWorkerCardProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings: companySettings } = useCompanySettings()
  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }

  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [activeForm, setActiveForm] = useState<WorkerActivePaperForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [duplicateFormId, setDuplicateFormId] = useState<string | null>(null)
  const [duplicateFormNumber, setDuplicateFormNumber] = useState<string | null>(null)

  const monthNumber = Number(month)
  const yearNumber = Number(year)

  const uiStatus = useMemo(
    () => mapWorkerPaperFormStatus(activeForm?.status as PaperFormStatus | undefined),
    [activeForm]
  )
  const statusMeta = WORKER_PAPER_FORM_STATUS[uiStatus]

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const form = await fetchWorkerActivePaperForm(workerId, monthNumber, yearNumber)
      setActiveForm(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení formuláře se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [workerId, monthNumber, yearNumber])

  useEffect(() => {
    load()
  }, [load])

  async function handlePrintExisting(formId: string) {
    setBusy(true)
    setError('')
    try {
      const [form, lines] = await Promise.all([fetchPaperForm(formId), fetchPaperFormLines(formId)])
      if (!form) throw new Error('Formulář nenalezen')
      const blob = await buildPaperMonthlyFormPdfBlob(form, lines, company)
      downloadPdfBlob(blob, getPaperFormPdfFilename(form))
      await markPaperFormPrinted(form.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tisk se nezdařil')
    } finally {
      setBusy(false)
      setDuplicateFormId(null)
    }
  }

  async function handleCreateAndPrint() {
    if (!isAdmin) return
    setBusy(true)
    setError('')
    setDuplicateFormId(null)
    try {
      const formId = await createPaperMonthlyFormForWorker(workerId, monthNumber, yearNumber, user?.id ?? null)
      await handlePrintExisting(formId)
    } catch (err) {
      const existingId = parseDuplicatePaperFormError(err)
      if (existingId) {
        const active = await fetchWorkerActivePaperForm(workerId, monthNumber, yearNumber)
        setDuplicateFormNumber(active?.form_number ?? null)
        setDuplicateFormId(existingId)
        return
      }
      setError(err instanceof Error ? err.message : 'Vytvoření formuláře se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!activeForm || !isAdmin) return
    if (!window.confirm('Opravdu zrušit aktivní papírový formulář pro tento měsíc?')) return
    setBusy(true)
    setError('')
    try {
      await cancelPaperMonthlyForm(activeForm.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zrušení se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateReplacement() {
    if (!duplicateFormId) return
    setBusy(true)
    setError('')
    try {
      const newId = await createPaperMonthlyFormReplacement(duplicateFormId, user?.id ?? null)
      setDuplicateFormId(null)
      await handlePrintExisting(newId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření náhradního formuláře se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  if (!isAdmin) return null

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear - i
    return { value: String(y), label: String(y) }
  })

  return (
    <>
      <Card className="mt-6 border border-[var(--gold-primary)]/30">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-base font-semibold text-theme-primary">
              <FileStack className="h-4 w-4 text-[var(--gold-primary)]" />
              Papírový měsíční výkaz – Varianta 1
            </h4>
            <p className="text-xs text-theme-muted">{formatPaperPeriod(monthNumber, yearNumber)}</p>
          </div>
          <StatusBadge variant={statusMeta.variant} label={`${statusMeta.emoji} ${statusMeta.label}`} />
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Select
            label="Měsíc"
            options={MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label }))}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Select label="Rok" options={yearOptions} value={year} onChange={(e) => setYear(e.target.value)} />
        </div>

        {loading ? (
          <p className="text-sm text-theme-muted">Načítám stav formuláře…</p>
        ) : (
          <>
            {uiStatus === 'waiting' && activeForm && (
              <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Formulář čeká na vrácení a import
                </p>
                <div className="mt-2 grid gap-1 text-xs text-theme-secondary sm:grid-cols-2">
                  <p>
                    <span className="text-theme-muted">Číslo:</span> {activeForm.form_number}
                  </p>
                  <p>
                    <span className="text-theme-muted">QR / ID:</span> {activeForm.public_id}
                  </p>
                </div>
              </div>
            )}

            {uiStatus === 'imported' && activeForm && (
              <p className="mb-3 text-sm text-theme-secondary">
                Formulář {activeForm.form_number} byl importován nebo je ve schvalování.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={busy}
                onClick={() => (activeForm ? handlePrintExisting(activeForm.id) : handleCreateAndPrint())}
              >
                <Printer className="h-4 w-4" />
                {activeForm ? 'Vytisknout znovu' : 'Vytisknout měsíční formulář'}
              </Button>
              {activeForm && uiStatus === 'waiting' && (
                <Button size="sm" variant="danger" loading={busy} onClick={handleCancel}>
                  <XCircle className="h-4 w-4" />
                  Zrušit formulář
                </Button>
              )}
              {activeForm && (
                <Link
                  to={`/vykazy/papierove/${activeForm.id}`}
                  className="btn-neon inline-flex min-h-[36px] items-center rounded-xl px-3 py-1.5 text-sm"
                >
                  Otevřít detail
                </Link>
              )}
            </div>
          </>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </Card>

      <PaperFormDuplicateDialog
        open={Boolean(duplicateFormId)}
        formNumber={duplicateFormNumber}
        busy={busy}
        onOpenExisting={() => {
          if (!duplicateFormId) return
          navigate(`/vykazy/papierove/${duplicateFormId}`)
        }}
        onReprintExisting={() => void handlePrintExisting(duplicateFormId!)}
        onCreateReplacement={() => void handleCreateReplacement()}
        onCancel={() => setDuplicateFormId(null)}
      />
    </>
  )
}

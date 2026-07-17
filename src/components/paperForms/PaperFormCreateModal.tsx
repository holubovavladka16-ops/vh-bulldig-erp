import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PaperFormDuplicateDialog } from '@/components/paperForms/PaperFormDuplicateDialog'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import {
  createPaperMonthlyFormForWorker,
  createPaperMonthlyFormReplacement,
  fetchPaperForm,
  fetchPaperFormLines,
  fetchWorkerActivePaperForm,
  markPaperFormPrinted,
} from '@/lib/paperForms/api'
import { buildPaperMonthlyFormPdfBlob, getPaperFormPdfFilename } from '@/lib/paperForms/pdf'
import { buildWorkerFormPreviewRows } from '@/lib/paperForms/workerSnapshot'
import { downloadPdfBlob } from '@/lib/print/pdfShare'
import { fetchWorker, fetchWorkers } from '@/lib/workers/api'
import { MONTH_NAMES } from '@/constants/paperForms'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'
import type { Worker } from '@/types/workers'

interface PaperFormCreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: (formId: string) => void
}

function parseDuplicateFormId(err: unknown): string | null {
  if (!(err instanceof Error)) return null
  if (err.message === 'DUPLICATE_ACTIVE_FORM') {
    return (err as Error & { existingFormId?: string }).existingFormId ?? null
  }
  const match = err.message.match(/DUPLICATE_ACTIVE_FORM:([0-9a-f-]+)/i)
  return match?.[1] ?? null
}

export function PaperFormCreateModal({ open, onClose, onCreated }: PaperFormCreateModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings: companySettings } = useCompanySettings()
  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }

  const now = new Date()
  const [workers, setWorkers] = useState<{ value: string; label: string }[]>([])
  const [workerId, setWorkerId] = useState('')
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [loading, setLoading] = useState(false)
  const [workerLoading, setWorkerLoading] = useState(false)
  const [error, setError] = useState('')
  const [duplicateFormId, setDuplicateFormId] = useState<string | null>(null)
  const [duplicateFormNumber, setDuplicateFormNumber] = useState<string | null>(null)

  const monthNumber = Number(month)
  const yearNumber = Number(year)
  const monthLabel = MONTH_NAMES[monthNumber - 1] ?? month

  const previewRows = useMemo(
    () => buildWorkerFormPreviewRows(selectedWorker, monthLabel, yearNumber),
    [selectedWorker, monthLabel, yearNumber]
  )

  useEffect(() => {
    if (!open) return
    fetchWorkers('aktivni').then((list) =>
      setWorkers(list.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` })))
    )
  }, [open])

  useEffect(() => {
    if (!open || !workerId) {
      setSelectedWorker(null)
      return
    }

    let cancelled = false
    setWorkerLoading(true)
    setError('')

    fetchWorker(workerId)
      .then((worker) => {
        if (cancelled) return
        setSelectedWorker(worker)
        if (!worker) setError('Zaměstnanec nenalezen nebo není aktivní')
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Načtení zaměstnance se nezdařilo')
      })
      .finally(() => {
        if (!cancelled) setWorkerLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, workerId])

  useEffect(() => {
    if (!open) {
      setWorkerId('')
      setSelectedWorker(null)
      setMonth(String(new Date().getMonth() + 1))
      setYear(String(new Date().getFullYear()))
      setError('')
      setDuplicateFormId(null)
      setDuplicateFormNumber(null)
    }
  }, [open])

  if (!open) return null

  async function loadDuplicateMeta(formId: string) {
    const active = await fetchWorkerActivePaperForm(workerId, monthNumber, yearNumber)
    setDuplicateFormNumber(active?.form_number ?? null)
    setDuplicateFormId(formId)
  }

  async function printForm(formId: string) {
    const [form, lines] = await Promise.all([fetchPaperForm(formId), fetchPaperFormLines(formId)])
    if (!form) throw new Error('Formulář nenalezen')
    const blob = await buildPaperMonthlyFormPdfBlob(form, lines, company)
    downloadPdfBlob(blob, getPaperFormPdfFilename(form))
    await markPaperFormPrinted(form.id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!workerId) {
      setError('Vyberte zaměstnance')
      return
    }

    setLoading(true)
    setError('')
    setDuplicateFormId(null)
    setDuplicateFormNumber(null)

    try {
      const id = await createPaperMonthlyFormForWorker(workerId, monthNumber, yearNumber, user?.id ?? null)
      onCreated(id)
    } catch (err) {
      const existingId = parseDuplicateFormId(err)
      if (existingId) {
        await loadDuplicateMeta(existingId)
        return
      }
      setError(err instanceof Error ? err.message : 'Vytvoření formuláře se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenExisting() {
    if (!duplicateFormId) return
    onClose()
    navigate(`/vykazy/papierove/${duplicateFormId}`)
  }

  async function handleReprintExisting() {
    if (!duplicateFormId) return
    setLoading(true)
    setError('')
    try {
      await printForm(duplicateFormId)
      setDuplicateFormId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tisk se nezdařil')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateReplacement() {
    if (!duplicateFormId) return
    setLoading(true)
    setError('')
    try {
      const newId = await createPaperMonthlyFormReplacement(duplicateFormId, user?.id ?? null)
      setDuplicateFormId(null)
      onCreated(newId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření náhradního formuláře se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="glass-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border-glass)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-theme-primary">Nový formulář – Varianta 1</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-theme-muted hover:bg-white/5">
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="mb-4 text-sm text-theme-secondary">
            Vyberte zaměstnance a měsíc. Údaje z karty zaměstnance se automaticky načtou a vyplní do PDF.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              label="Zaměstnanec"
              options={[{ value: '', label: '— Vyberte zaměstnance —' }, ...workers]}
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Měsíc"
                options={MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label }))}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
              <Input
                label="Rok"
                type="number"
                min={2020}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>

            {workerId && (
              <div className="rounded-xl border border-[var(--border-glass)] bg-white/[0.03] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-theme-muted">
                  Náhled údajů pro PDF
                </p>
                {workerLoading ? (
                  <p className="text-sm text-theme-muted">Načítám údaje zaměstnance…</p>
                ) : previewRows.length > 0 ? (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {previewRows.map((row) => (
                      <div key={row.label}>
                        <dt className="text-xs text-theme-muted">{row.label}</dt>
                        <dd className="text-sm text-theme-primary">{row.value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-theme-muted">Údaje zaměstnance nejsou k dispozici.</p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Zrušit
              </Button>
              <Button type="submit" loading={loading} disabled={!workerId || workerLoading}>
                Vytvořit formulář
              </Button>
            </div>
          </form>
        </div>
      </div>

      <PaperFormDuplicateDialog
        open={Boolean(duplicateFormId)}
        formNumber={duplicateFormNumber}
        busy={loading}
        onOpenExisting={() => void handleOpenExisting()}
        onReprintExisting={() => void handleReprintExisting()}
        onCreateReplacement={() => void handleCreateReplacement()}
        onCancel={() => setDuplicateFormId(null)}
      />
    </>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePlus2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { PaperFormDuplicateDialog } from '@/components/paperForms/PaperFormDuplicateDialog'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import {
  DuplicateActivePaperFormError,
  createPaperMonthlyFormForWorker,
  createPaperMonthlyReplacementForm,
  fetchPaperForm,
  printPaperMonthlyFormPdf,
} from '@/lib/paperForms/api'
import { fetchWorkers } from '@/lib/workers/api'
import { MONTH_NAMES } from '@/constants/paperForms'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'

interface PaperFormCreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: (formId: string) => void
  preselectedWorkerId?: string
}

export function PaperFormCreateModal({ open, onClose, onCreated, preselectedWorkerId }: PaperFormCreateModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { settings: companySettings } = useCompanySettings()
  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }

  const now = new Date()
  const [workers, setWorkers] = useState<{ value: string; label: string }[]>([])
  const [workerId, setWorkerId] = useState('')
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const yearNumber = now.getFullYear()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [duplicateFormId, setDuplicateFormId] = useState<string | null>(null)
  const [duplicateFormNumber, setDuplicateFormNumber] = useState<string | null>(null)

  const monthNumber = Number(month)
  const canSubmit = Boolean(workerId && month && monthNumber >= 1 && monthNumber <= 12)

  useEffect(() => {
    if (!open) return
    fetchWorkers('aktivni').then((list) =>
      setWorkers(list.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` })))
    )
  }, [open])

  useEffect(() => {
    if (!open) {
      setWorkerId(preselectedWorkerId ?? '')
      setMonth(String(new Date().getMonth() + 1))
      setError('')
      setDuplicateFormId(null)
      setDuplicateFormNumber(null)
    } else if (preselectedWorkerId) {
      setWorkerId(preselectedWorkerId)
    }
  }, [open, preselectedWorkerId])

  if (!open) return null

  async function openDuplicateDialog(existingFormId: string) {
    setDuplicateFormId(existingFormId)
    try {
      const existing = await fetchPaperForm(existingFormId)
      setDuplicateFormNumber(existing?.form_number ?? null)
    } catch {
      setDuplicateFormNumber(null)
    }
  }

  async function createAndPrintPdf(formId: string) {
    await printPaperMonthlyFormPdf(formId, company)
    onCreated(formId)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) {
      setError('Vyberte zaměstnance a měsíc')
      return
    }

    setLoading(true)
    setError('')
    setDuplicateFormId(null)
    setDuplicateFormNumber(null)

    try {
      const id = await createPaperMonthlyFormForWorker(workerId, monthNumber, yearNumber, user?.id ?? null)
      await createAndPrintPdf(id)
    } catch (err) {
      if (err instanceof DuplicateActivePaperFormError) {
        await openDuplicateDialog(err.existingFormId)
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
      await printPaperMonthlyFormPdf(duplicateFormId, company)
      setDuplicateFormId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generování PDF se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateReplacement() {
    if (!duplicateFormId || !workerId) return
    setLoading(true)
    setError('')
    try {
      const newId = await createPaperMonthlyReplacementForm(workerId, monthNumber, yearNumber, user?.id ?? null)
      setDuplicateFormId(null)
      await createAndPrintPdf(newId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření náhradního formuláře se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="paper-form-create-title">
        <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
        <div className="modal-panel modal-panel-md glass-panel neon-border flex max-h-[100dvh] flex-col overflow-hidden sm:max-h-[92vh]">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-glass)] pb-4">
            <h2 id="paper-form-create-title" className="text-lg font-semibold text-theme-primary sm:text-xl">
              Varianta 1 — konkrétní zaměstnanec
            </h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 scrollbar-premium">
            <p className="mb-4 text-sm text-theme-secondary">
              Vyberte zaměstnance a měsíc. Systém automaticky načte údaje z osobní karty, uloží formulář a otevře PDF.
            </p>

            <form id="paper-form-create" onSubmit={handleSubmit} className="space-y-4">
              <Select
                label="Zaměstnanec *"
                options={[{ value: '', label: '— Vyberte zaměstnance —' }, ...workers]}
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                disabled={Boolean(preselectedWorkerId)}
                required
              />
              <Select
                label={`Měsíc * (rok ${yearNumber})`}
                options={MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label }))}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
            </form>
          </div>

          <div className="modal-footer shrink-0 border-t border-[var(--border-glass)] pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Zrušit
            </Button>
            <Button type="submit" form="paper-form-create" loading={loading} disabled={!canSubmit}>
              <FilePlus2 className="h-4 w-4" />
              Vytvořit formulář
            </Button>
          </div>
        </div>
      </div>

      <PaperFormDuplicateDialog
        open={Boolean(duplicateFormId)}
        formNumber={duplicateFormNumber}
        loading={loading}
        onOpenExisting={() => void handleOpenExisting()}
        onReprint={() => void handleReprintExisting()}
        onCreateReplacement={() => void handleCreateReplacement()}
        onCancel={() => setDuplicateFormId(null)}
      />
    </>
  )
}

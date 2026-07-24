import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FilePlus2, FileStack, Printer, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { PaperFormCreateModal } from '@/components/paperForms/PaperFormCreateModal'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import {
  cancelPaperMonthlyForm,
  fetchWorkerActivePaperForm,
  printPaperMonthlyFormPdf,
  type WorkerActivePaperForm,
} from '@/lib/paperForms/api'
import {
  WORKER_PAPER_FORM_STATUS,
  formatPaperPeriod,
  mapWorkerPaperFormStatus,
} from '@/constants/paperForms'
import type { PaperFormStatus } from '@/types/paperForms'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'
import { formatDate } from '@/constants/workers'

interface PaperFormWorkerCardProps {
  workerId: string
  isAdmin: boolean
}

export function PaperFormWorkerCard({ workerId, isAdmin }: PaperFormWorkerCardProps) {
  const navigate = useNavigate()
  const { settings: companySettings } = useCompanySettings()
  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }

  const now = new Date()
  const [month] = useState(now.getMonth() + 1)
  const [year] = useState(now.getFullYear())
  const [activeForm, setActiveForm] = useState<WorkerActivePaperForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const uiStatus = useMemo(
    () => mapWorkerPaperFormStatus(activeForm?.status as PaperFormStatus | undefined),
    [activeForm]
  )
  const statusMeta = WORKER_PAPER_FORM_STATUS[uiStatus]

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const form = await fetchWorkerActivePaperForm(workerId, month, year)
      setActiveForm(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení formuláře se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [workerId, month, year])

  useEffect(() => {
    load()
  }, [load])

  async function handlePrintExisting(formId: string) {
    setBusy(true)
    setError('')
    try {
      await printPaperMonthlyFormPdf(formId, company)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tisk se nezdařil')
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

  if (!isAdmin) return null

  return (
    <>
      <Card className="mt-6 border border-[var(--gold-primary)]/30">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-base font-semibold text-theme-primary">
              <FileStack className="h-4 w-4 text-[var(--gold-primary)]" />
              Papírový měsíční výkaz
            </h4>
            <p className="text-xs text-theme-muted">{formatPaperPeriod(month, year)}</p>
          </div>
          <StatusBadge variant={statusMeta.variant} label={`${statusMeta.emoji} ${statusMeta.label}`} />
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
                    <span className="text-theme-muted">Datum tisku:</span>{' '}
                    {activeForm.printed_at ? formatDate(activeForm.printed_at) : '—'}
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
              {activeForm ? (
                <Button size="sm" loading={busy} onClick={() => void handlePrintExisting(activeForm.id)}>
                  <Printer className="h-4 w-4" />
                  Vytisknout znovu
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <FilePlus2 className="h-4 w-4" />
                  Nový formulář
                </Button>
              )}
              {activeForm && uiStatus === 'waiting' && (
                <Button size="sm" variant="danger" loading={busy} onClick={handleCancel}>
                  <XCircle className="h-4 w-4" />
                  Zrušit formulář
                </Button>
              )}
              {activeForm && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/vykazy/papierove/${activeForm.id}`)}
                >
                  Otevřít detail
                </Button>
              )}
            </div>
          </>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </Card>

      <PaperFormCreateModal
        open={createOpen}
        preselectedWorkerId={workerId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          void load()
        }}
      />
    </>
  )
}

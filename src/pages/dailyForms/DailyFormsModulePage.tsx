import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Pencil } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { fetchWorkers, approveForm, returnFormForCorrection } from '@/lib/workers/api'
import { fetchAllDailyForms, type DailyFormFilters, type DailyFormListRecord } from '@/lib/workers/dailyForms'
import { fetchJobOrders } from '@/lib/orders/api'
import {
  WORK_TYPE_LABELS,
  WORKER_FORM_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from '@/constants/workers'
import type { WorkerFormStatus } from '@/types/workers'

const STATUS_OPTIONS: { value: WorkerFormStatus | ''; label: string }[] = [
  { value: '', label: 'Všechny stavy' },
  { value: 'koncept', label: 'Koncept' },
  { value: 'odeslany', label: 'Odeslaný' },
  { value: 'schvaleny', label: 'Schválený' },
  { value: 'k_oprave', label: 'K opravě' },
]

export function DailyFormsModulePage() {
  const { user } = useAuth()
  const [forms, setForms] = useState<DailyFormListRecord[]>([])
  const [workers, setWorkers] = useState<{ value: string; label: string }[]>([])
  const [orders, setOrders] = useState<{ value: string; label: string }[]>([])
  const [filters, setFilters] = useState<DailyFormFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetchWorkers('vse').then((list) =>
        setWorkers([
          { value: '', label: 'Všichni zaměstnanci' },
          ...list.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` })),
        ])
      ),
      fetchJobOrders().then((list) =>
        setOrders([
          { value: '', label: 'Všechny zakázky' },
          ...list.map((o) => ({ value: o.id, label: o.name })),
        ])
      ),
    ]).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setForms(await fetchAllDailyForms(filters))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení formulářů se nezdařilo')
      setForms([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleApprove(form: DailyFormListRecord) {
    if (!user) return
    await approveForm(form.id, form.worker_id, user.id)
    await load()
  }

  async function handleReturn(form: DailyFormListRecord) {
    if (!user) return
    await returnFormForCorrection(form.id, form.worker_id, user.id)
    await load()
  }

  return (
    <AppLayout>
      <PageHeader
        title="Denní formuláře"
        description="Přehled všech denních formulářů zaměstnanců – schvalování, úpravy a automatické propojení s výkazy a docházkou."
      />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Select
            label="Zaměstnanec"
            options={workers}
            value={filters.workerId ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, workerId: e.target.value || undefined }))}
          />
          <Select
            label="Zakázka"
            options={orders}
            value={filters.orderId ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, orderId: e.target.value || undefined }))}
          />
          <Select
            label="Stav"
            options={STATUS_OPTIONS}
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: (e.target.value as WorkerFormStatus) || undefined }))
            }
          />
          <Input
            label="Datum od"
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))}
          />
          <Input
            label="Datum do"
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value || undefined }))}
          />
        </div>
        <div className="mt-4">
          <Input
            label="Hledat"
            placeholder="Jméno zaměstnance nebo zakázka…"
            value={filters.search ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))}
          />
        </div>
      </Card>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'Datum' },
            { key: 'worker', label: 'Zaměstnanec' },
            { key: 'order', label: 'Zakázka' },
            { key: 'type', label: 'Typ práce' },
            { key: 'hours', label: 'Hodiny' },
            { key: 'earnings', label: 'Výdělek' },
            { key: 'status', label: 'Stav' },
            { key: 'actions', label: 'Akce' },
          ]}
          isEmpty={forms.length === 0}
          emptyMessage="Žádné denní formuláře pro zadané filtry."
        >
          {forms.map((form) => (
            <DataTableRow key={form.id}>
              <DataTableCell>{formatDate(form.form_date)}</DataTableCell>
              <DataTableCell className="min-w-[140px]">
                {form.worker_last_name} {form.worker_first_name}
              </DataTableCell>
              <DataTableCell>{form.order_name || '—'}</DataTableCell>
              <DataTableCell>{WORK_TYPE_LABELS[form.work_type ?? 'ukolova']}</DataTableCell>
              <DataTableCell>{form.hours} h</DataTableCell>
              <DataTableCell>{formatCurrency(form.earnings)}</DataTableCell>
              <DataTableCell>
                <StatusBadge
                  label={WORKER_FORM_STATUS_LABELS[form.status]}
                  variant={form.status === 'schvaleny' ? 'success' : form.status === 'odeslany' ? 'info' : 'warning'}
                />
              </DataTableCell>
              <DataTableCell>
                <div className="flex flex-wrap gap-1">
                  <Link to={`/delnici/${form.worker_id}/vykazy`}>
                    <Button variant="ghost" size="sm" aria-label="Detail zaměstnance">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  {form.status === 'odeslany' && (
                    <Button variant="secondary" size="sm" onClick={() => handleApprove(form)}>
                      Schválit
                    </Button>
                  )}
                  {(form.status === 'odeslany' || form.status === 'schvaleny') && (
                    <Button variant="ghost" size="sm" onClick={() => handleReturn(form)}>
                      K opravě
                    </Button>
                  )}
                  <Link to={`/vykazy`}>
                    <Button variant="ghost" size="sm" title="Výkazy">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </AppLayout>
  )
}

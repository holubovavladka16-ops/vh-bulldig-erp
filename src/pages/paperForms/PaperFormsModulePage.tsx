import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileStack, Plus, ScanLine, Copy } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DataTable, DataTableCell, DataTableRow } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { PaperFormCreateModal } from '@/components/paperForms/PaperFormCreateModal'
import { PaperFormBulkCreateModal } from '@/components/paperForms/PaperFormBulkCreateModal'
import { fetchPaperForms, type PaperFormFilters } from '@/lib/paperForms/api'
import { fetchWorkers } from '@/lib/workers/api'
import { PAPER_FORM_STATUS_LABELS, PAPER_FORM_STATUS_VARIANT, PAPER_FORM_STATUS_FILTERS, MONTH_NAMES, formatPaperPeriod } from '@/constants/paperForms'
import type { PaperFormListItem, PaperFormStatus } from '@/types/paperForms'

const STATUS_OPTIONS = PAPER_FORM_STATUS_FILTERS

const MONTH_OPTIONS = [
  { value: '', label: 'Všechny měsíce' },
  ...MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label })),
]

export function PaperFormsModulePage() {
  const [forms, setForms] = useState<PaperFormListItem[]>([])
  const [workers, setWorkers] = useState<{ value: string; label: string }[]>([])
  const [filters, setFilters] = useState<PaperFormFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false)

  useEffect(() => {
    fetchWorkers('aktivni').then((list) =>
      setWorkers([
        { value: '', label: 'Všichni zaměstnanci' },
        ...list.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` })),
      ])
    )
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setForms(await fetchPaperForms(filters))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení formulářů se nezdařilo')
      setForms([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = setTimeout(load, 200)
    return () => clearTimeout(timeout)
  }, [load])

  const currentYear = new Date().getFullYear()
  const yearOptions = [
    { value: '', label: 'Všechny roky' },
    ...Array.from({ length: 5 }, (_, i) => {
      const y = currentYear - i
      return { value: String(y), label: String(y) }
    }),
  ]

  return (
    <AppLayout>
      <PageHeader
        title="Papírové měsíční výkazy"
        description="Inteligentní papírový formulář pro zaměstnance bez mobilu — QR, OCR, docházka, výkazy a mzdy."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Varianta 1 – formulář pro konkrétního zaměstnance
            </Button>
            <Button variant="secondary" onClick={() => setBulkCreateOpen(true)}>
              <Copy className="h-4 w-4" />
              Varianta 2 – hromadný tisk prázdných formulářů
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Select
            label="Měsíc"
            options={MONTH_OPTIONS}
            value={filters.month ? String(filters.month) : ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, month: e.target.value ? Number(e.target.value) : undefined }))
            }
          />
          <Select
            label="Rok"
            options={yearOptions}
            value={filters.year ? String(filters.year) : ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, year: e.target.value ? Number(e.target.value) : undefined }))
            }
          />
          <Select
            label="Stav"
            options={STATUS_OPTIONS}
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value || undefined }))
            }
          />
          <Select
            label="Zaměstnanec"
            options={workers}
            value={filters.workerId ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, workerId: e.target.value || undefined }))}
          />
          <Input
            label="Hledat"
            placeholder="Číslo formuláře, QR…"
            value={filters.search ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))}
          />
        </div>
      </Card>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <Card className="py-12 text-center text-theme-secondary">Načítání…</Card>
      ) : forms.length === 0 ? (
        <Card className="py-16 text-center">
          <FileStack className="mx-auto mb-4 h-12 w-12 text-theme-muted" />
          <h2 className="text-lg font-semibold text-theme-primary">Zatím žádné papírové formuláře</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-theme-secondary">
            Vytvořte formulář pro konkrétního zaměstnance (Varianta 1) nebo vytiskněte hromadně prázdné formuláře
            (Varianta 2).
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Varianta 1 – konkrétní zaměstnanec
            </Button>
            <Button variant="secondary" onClick={() => setBulkCreateOpen(true)}>
              <Copy className="h-4 w-4" />
              Varianta 2 – hromadný tisk
            </Button>
          </div>
        </Card>
      ) : (
        <DataTable
          columns={[
            { key: 'number', label: 'Číslo' },
            { key: 'period', label: 'Období' },
            { key: 'worker', label: 'Zaměstnanec' },
            { key: 'status', label: 'Stav' },
            { key: 'ai', label: 'AI jistota' },
            { key: 'actions', label: 'Akce' },
          ]}
        >
          {forms.map((form) => (
            <DataTableRow key={form.id}>
              <DataTableCell>
                <div>
                  <p className="font-medium text-theme-primary">{form.form_number}</p>
                  <p className="text-xs text-theme-muted">{form.public_id}</p>
                </div>
              </DataTableCell>
              <DataTableCell>{formatPaperPeriod(form.month, form.year)}</DataTableCell>
              <DataTableCell>{form.worker_name ?? '— Nepřiřazeno —'}</DataTableCell>
              <DataTableCell>
                <StatusBadge
                  label={PAPER_FORM_STATUS_LABELS[form.status as PaperFormStatus]}
                  variant={PAPER_FORM_STATUS_VARIANT[form.status as PaperFormStatus]}
                />
              </DataTableCell>
              <DataTableCell>
                {form.ai_confidence != null ? `${Math.round(form.ai_confidence)} %` : '—'}
              </DataTableCell>
              <DataTableCell>
                <Link to={`/vykazy/papierove/${form.id}`}>
                  <Button variant="secondary" size="sm">
                    <ScanLine className="h-3.5 w-3.5" />
                    Detail
                  </Button>
                </Link>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      <PaperFormCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          load()
        }}
      />

      <PaperFormBulkCreateModal
        open={bulkCreateOpen}
        onClose={() => setBulkCreateOpen(false)}
        onCreated={() => {
          setBulkCreateOpen(false)
          load()
        }}
      />
    </AppLayout>
  )
}

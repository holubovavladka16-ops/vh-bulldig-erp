import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, ScanLine } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { FormCheckHistoryList } from '@/components/formCheck/FormCheckHistoryList'
import { FormCheckStatsPanel } from '@/components/formCheck/FormCheckStatsPanel'
import { FORM_CHECK_OUTCOME_FILTER_OPTIONS } from '@/constants/formCheck'
import { MONTH_NAMES } from '@/constants/paperForms'
import {
  fetchFormCheckAuditors,
  fetchFormCheckRecords,
  fetchFormCheckStats,
} from '@/lib/formCheck/records'
import { fetchWorkers } from '@/lib/workers/api'
import type { FormCheckHistoryFilters, FormCheckRecordListItem, FormCheckStats } from '@/types/formCheck'

const MONTH_OPTIONS = [
  { value: '', label: 'Všechny měsíce' },
  ...MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label })),
]

const EMPTY_STATS: FormCheckStats = {
  totalChecks: 0,
  matchCount: 0,
  mismatchCount: 0,
  manualReviewCount: 0,
  ocrSuccessRate: null,
  averageConfidence: null,
}

export function FormCheckHistoryPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<FormCheckRecordListItem[]>([])
  const [stats, setStats] = useState<FormCheckStats>(EMPTY_STATS)
  const [workers, setWorkers] = useState<{ value: string; label: string }[]>([])
  const [auditors, setAuditors] = useState<{ value: string; label: string }[]>([])
  const [filters, setFilters] = useState<FormCheckHistoryFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchWorkers('aktivni').then((list) =>
      setWorkers([
        { value: '', label: 'Všichni zaměstnanci' },
        ...list.map((w) => ({ value: w.id, label: `${w.last_name} ${w.first_name}` })),
      ])
    )
    fetchFormCheckAuditors()
      .then((list) =>
        setAuditors([
          { value: '', label: 'Všichni uživatelé' },
          ...list.map((a) => ({ value: a.id, label: a.name })),
        ])
      )
      .catch(() => setAuditors([{ value: '', label: 'Všichni uživatelé' }]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, statsData] = await Promise.all([
        fetchFormCheckRecords(filters),
        fetchFormCheckStats(filters),
      ])
      setRecords(list)
      setStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení historie kontrol se nezdařilo')
      setRecords([])
      setStats(EMPTY_STATS)
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
        title="Historie kontrol formulářů"
        description="Přehled provedených kontrol papírových měsíčních výkazů. Kontrola nikdy nemění docházku v ERP."
        action={
          <Button variant="secondary" onClick={() => navigate('/kontrola-formulare')}>
            <ScanLine className="h-4 w-4" />
            Nová kontrola
          </Button>
        }
      />

      <div className="mb-6">
        <FormCheckStatsPanel stats={stats} />
      </div>

      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-theme-secondary" />
          <h3 className="text-lg font-semibold text-theme-primary">Filtry</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Select
            label="Zaměstnanec"
            options={workers}
            value={filters.workerId ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, workerId: e.target.value || undefined }))
            }
          />
          <Select
            label="Měsíc"
            options={MONTH_OPTIONS}
            value={filters.month ? String(filters.month) : ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                month: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
          <Select
            label="Rok"
            options={yearOptions}
            value={filters.year ? String(filters.year) : ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                year: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
          <Select
            label="Výsledek"
            options={FORM_CHECK_OUTCOME_FILTER_OPTIONS}
            value={filters.outcome ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                outcome: (e.target.value || undefined) as FormCheckHistoryFilters['outcome'],
              }))
            }
          />
          <Select
            label="Uživatel"
            options={auditors}
            value={filters.checkedBy ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, checkedBy: e.target.value || undefined }))
            }
          />
        </div>
      </Card>

      {error && (
        <Card className="mb-4 border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <FormCheckHistoryList records={records} loading={loading} />
    </AppLayout>
  )
}

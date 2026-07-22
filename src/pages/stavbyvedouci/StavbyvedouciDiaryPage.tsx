import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DiaryFormModal } from '@/components/diary/DiaryFormModal'
import { useAuth } from '@/context/AuthContext'
import { DIARY_ENTRY_STATUS_LABELS } from '@/constants/diary'
import type { DiaryEntryStatus } from '@/constants/diary'
import {
  canStavbyvedouciEditDiary,
  createStavbyvedouciDiaryEntry,
  fetchAssignedProjectsWithMarkers,
  fetchMyDiaryEntries,
  groupDiaryByStatus,
  updateStavbyvedouciDiaryEntry,
} from '@/lib/stavbyvedouci/api'
import type { ConstructionDiaryCreateInput, ConstructionDiaryEntry } from '@/types/diary'

const STATUS_SECTIONS = [
  { key: 'draft', title: 'Rozepsané', entriesKey: 'draft' as const },
  { key: 'pending', title: 'Čeká na kontrolu', entriesKey: 'pending' as const },
  { key: 'returned', title: 'Vrácené k opravě', entriesKey: 'returned' as const },
  { key: 'approved', title: 'Schválené', entriesKey: 'approved' as const },
  { key: 'rejected', title: 'Zamítnuté', entriesKey: 'rejected' as const },
]

export function StavbyvedouciDiaryPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile } = useAuth()
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [defaultOrderId, setDefaultOrderId] = useState<string | undefined>()
  const [defaultEntryDate, setDefaultEntryDate] = useState<string | undefined>()
  const [entries, setEntries] = useState<ConstructionDiaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<ConstructionDiaryEntry | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [projects, diaryRows] = await Promise.all([
        fetchAssignedProjectsWithMarkers(),
        fetchMyDiaryEntries(user.id),
      ])
      const options = projects.map((item) => ({
        value: item.project_id,
        label: `${item.order.name} – ${item.order.location}`,
      }))
      setOrderOptions(options)
      setEntries(diaryRows)

      const prefill = searchParams.get('orderId')
      const entryDate = searchParams.get('entryDate')
      if (prefill && options.some((option) => option.value === prefill)) {
        setDefaultOrderId(prefill)
        if (entryDate) {
          setDefaultEntryDate(entryDate)
          setEditEntry(null)
          setFormOpen(true)
        }
      } else if (options.length === 1) {
        setDefaultOrderId(options[0].value)
      }
    } finally {
      setLoading(false)
    }
  }, [searchParams, user])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => groupDiaryByStatus(entries), [entries])

  async function saveEntry(data: ConstructionDiaryCreateInput, status: DiaryEntryStatus) {
    if (!user) return
    if (editEntry) {
      await updateStavbyvedouciDiaryEntry(editEntry.id, data, status)
      setEditEntry(null)
    } else {
      await createStavbyvedouciDiaryEntry(data, user.id, status)
    }
    await load()
  }

  function openCreate() {
    setEditEntry(null)
    setFormOpen(true)
  }

  function openEdit(entry: ConstructionDiaryEntry) {
    if (!profile || !canStavbyvedouciEditDiary(entry, profile.id)) return
    setEditEntry(entry)
    setFormOpen(true)
  }

  return (
    <AppLayout>
      <Button variant="ghost" className="mb-4 min-h-[44px]" onClick={() => navigate('/stavbyvedouci')}>
        <ArrowLeft className="h-4 w-4" />
        Zpět
      </Button>

      <PageHeader
        title="Stavební deník"
        description="Zápisy pouze k přiděleným zakázkám. Upravit lze rozepsané a vrácené záznamy."
        action={
          <Button className="min-h-[44px]" onClick={openCreate} disabled={orderOptions.length === 0}>
            <Plus className="h-4 w-4" />
            Nový zápis
          </Button>
        }
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {orderOptions.length === 0 && !loading ? (
          <Card className="p-4 text-sm text-theme-muted">
            Nemáte aktivní přiřazení k žádné zakázce – deník nelze zapsat.
          </Card>
        ) : null}

        {STATUS_SECTIONS.map((section) => {
          const sectionEntries = grouped[section.entriesKey]
          return (
            <Card key={section.key} className="p-4">
              <h2 className="mb-3 text-lg font-semibold text-theme-primary">
                {section.title} ({sectionEntries.length})
              </h2>
              {loading ? (
                <p className="text-sm text-theme-muted">Načítám…</p>
              ) : sectionEntries.length === 0 ? (
                <p className="text-sm text-theme-muted">Žádné záznamy</p>
              ) : (
                <ul className="space-y-2">
                  {sectionEntries.map((entry) => {
                    const editable = profile ? canStavbyvedouciEditDiary(entry, profile.id) : false
                    return (
                      <li
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-theme-primary">
                            {entry.order_name ?? 'Zakázka'} · {entry.entry_date}
                          </p>
                          <p className="text-xs text-theme-muted">
                            {DIARY_ENTRY_STATUS_LABELS[entry.entry_status]}
                          </p>
                        </div>
                        {editable ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="min-h-[40px]"
                            onClick={() => openEdit(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                            Upravit
                          </Button>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          )
        })}
      </div>

      <DiaryFormModal
        open={formOpen}
        initial={editEntry}
        orderOptions={orderOptions}
        defaultOrderId={defaultOrderId}
        defaultEntryDate={defaultEntryDate}
        onClose={() => {
          setFormOpen(false)
          setEditEntry(null)
        }}
        dualSubmit
        onSaveDraft={(data) => saveEntry(data, 'draft')}
        onSubmitForReview={(data) => saveEntry(data, 'submitted')}
      />
    </AppLayout>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { DiaryFormModal } from '@/components/diary/DiaryFormModal'
import { DiaryDetailModal } from '@/components/diary/DiaryDetailModal'
import { useAuth } from '@/context/AuthContext'
import { isAdministrator } from '@/constants/permissions'
import { fetchJobOrders } from '@/lib/orders/api'
import {
  fetchDiaryEntries,
  createDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
} from '@/lib/diary/api'
import type { ConstructionDiaryEntry, ConstructionDiaryFilters, ConstructionDiaryCreateInput, PendingDiaryPhoto } from '@/types/diary'
import { formatDate } from '@/constants/workers'

export function DiaryModulePage() {
  const { profile, user } = useAuth()
  const isAdmin = profile ? isAdministrator(profile.role) : false

  const [entries, setEntries] = useState<ConstructionDiaryEntry[]>([])
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([])
  const [filters, setFilters] = useState<ConstructionDiaryFilters>({})
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<ConstructionDiaryEntry | null>(null)
  const [viewEntryId, setViewEntryId] = useState<string | null>(null)

  useEffect(() => {
    fetchJobOrders()
      .then((orders) => setOrderOptions(orders.map((o) => ({ value: o.id, label: o.name }))))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setEntries(await fetchDiaryEntries(filters))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timeout = setTimeout(load, 250)
    return () => clearTimeout(timeout)
  }, [load])

  async function handleCreate(data: ConstructionDiaryCreateInput, photos: PendingDiaryPhoto[]) {
    if (!user) return
    await createDiaryEntry(data, user.id, photos)
    await load()
  }

  async function handleUpdate(data: ConstructionDiaryCreateInput, photos: PendingDiaryPhoto[]) {
    if (!editEntry || !user) return
    await updateDiaryEntry(editEntry.id, data, user.id, photos)
    setEditEntry(null)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Smazat tento zápis stavebního deníku?')) return
    await deleteDiaryEntry(id)
    await load()
  }

  const filterOrderOptions = [{ value: '', label: 'Všechny zakázky' }, ...orderOptions]

  return (
    <AppLayout>
      <PageHeader
        title="Stavební deník"
        description="Evidence denních zápisů ze stavby včetně fotodokumentace s GPS."
        action={
          isAdmin ? (
            <Button onClick={() => { setEditEntry(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" />
              Nový zápis
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="Zakázka"
            options={filterOrderOptions}
            value={filters.orderId ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, orderId: e.target.value || undefined }))}
          />
          <Input label="Datum od" type="date" value={filters.dateFrom ?? ''} onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))} />
          <Input label="Datum do" type="date" value={filters.dateTo ?? ''} onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value || undefined }))} />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'Datum' },
            { key: 'order', label: 'Zakázka' },
            { key: 'weather', label: 'Počasí' },
            { key: 'workers', label: 'Dělníci' },
            { key: 'actions', label: 'Akce', className: 'text-right' },
          ]}
          isEmpty={entries.length === 0}
          emptyMessage="Žádné zápisy stavebního deníku."
        >
          {entries.map((entry) => (
            <DataTableRow key={entry.id}>
              <DataTableCell>{formatDate(entry.entry_date)}</DataTableCell>
              <DataTableCell>{entry.order_name ?? '—'}</DataTableCell>
              <DataTableCell>{entry.weather}</DataTableCell>
              <DataTableCell>{entry.worker_count}</DataTableCell>
              <DataTableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setViewEntryId(entry.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => { setEditEntry(entry); setFormOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      <DiaryFormModal
        open={formOpen}
        initial={editEntry}
        orderOptions={orderOptions}
        onClose={() => { setFormOpen(false); setEditEntry(null) }}
        onSubmit={editEntry ? handleUpdate : handleCreate}
      />

      <DiaryDetailModal entryId={viewEntryId} onClose={() => setViewEntryId(null)} />
    </AppLayout>
  )
}

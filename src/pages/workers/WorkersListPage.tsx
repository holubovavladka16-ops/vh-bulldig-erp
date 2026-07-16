import { useEffect, useState, useCallback } from 'react'
import { Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { WorkerTable } from '@/components/workers/WorkerTable'
import { WorkerCreateModal } from '@/components/workers/WorkerCreateModal'
import { useAuth } from '@/context/AuthContext'
import { isAdministrator } from '@/constants/permissions'
import {
  fetchWorkers,
  createWorker,
  archiveWorker,
  restoreWorker,
  deleteWorker,
  uploadWorkerPhoto,
} from '@/lib/workers/api'
import type { WorkerFilter, WorkerCreateInput } from '@/types/workers'

const FILTERS: { id: WorkerFilter; label: string }[] = [
  { id: 'aktivni', label: 'Aktivní' },
  { id: 'neaktivni', label: 'Neaktivní' },
  { id: 'archiv', label: 'Archiv' },
  { id: 'vse', label: 'Vše' },
]

export function WorkersListPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [workers, setWorkers] = useState<Awaited<ReturnType<typeof fetchWorkers>>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<WorkerFilter>('aktivni')
  const [modalOpen, setModalOpen] = useState(false)

  const isAdmin = profile ? isAdministrator(profile.role) : false

  const loadWorkers = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchWorkers(filter, search)
      setWorkers(data)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Nepodařilo se načíst zaměstnance')
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    const timeout = setTimeout(loadWorkers, 300)
    return () => clearTimeout(timeout)
  }, [loadWorkers])

  async function handleCreate(data: WorkerCreateInput, photoFile?: File) {
    if (!user) return
    const worker = await createWorker(data, user.id)
    if (photoFile) await uploadWorkerPhoto(worker.id, photoFile)
    await loadWorkers()
    navigate(`/delnici/${worker.id}/osobni-karta`)
  }

  async function handleArchive(id: string) {
    if (!user || !confirm('Opravdu archivovat tohoto zaměstnance?')) return
    await archiveWorker(id, user.id)
    await loadWorkers()
  }

  async function handleRestore(id: string) {
    if (!user) return
    await restoreWorker(id, user.id)
    await loadWorkers()
  }

  async function handleDelete(id: string) {
    if (!confirm('Opravdu trvale smazat zaměstnance a všechna související data?')) return
    await deleteWorker(id)
    await loadWorkers()
  }

  return (
    <AppLayout title="Dělníci">
      <PageHeader
        title="Dělníci"
        description="Centrální evidence zaměstnanců VH Bulldig s.r.o."
        action={
          isAdmin ? (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Nový zaměstnanec
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-muted" />
          <Input
            placeholder="Hledat jméno, příjmení, telefon, pozici…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${
                filter === f.id ? 'nav-item-active text-accent' : 'neon-border border-transparent text-theme-secondary hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <WorkerTable
          workers={workers}
          onView={(id) => navigate(`/delnici/${id}/osobni-karta`)}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onDelete={handleDelete}
          isAdmin={isAdmin}
        />
      )}

      <WorkerCreateModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
    </AppLayout>
  )
}

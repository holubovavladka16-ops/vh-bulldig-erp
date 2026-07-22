import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Plus, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { isStavbyvedouci } from '@/constants/permissions'
import { ProjectDiaryEntryCard } from '@/components/zakazkyMapa/ProjectDiaryEntryCard'
import { ProjectDiaryEntryDetail } from '@/components/zakazkyMapa/ProjectDiaryEntryDetail'
import {
  fetchProjectDiaryPage,
  PROJECT_DIARY_PAGE_SIZE,
  type ProjectDiaryListItem,
} from '@/lib/zakazkyMapa/diaryApi'

interface ProjectDiaryListProps {
  orderId: string
  orderName: string
  canCreateEntry: boolean
  onCreateEntry: () => void
}

export function ProjectDiaryList({
  orderId,
  orderName,
  canCreateEntry,
  onCreateEntry,
}: ProjectDiaryListProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [entries, setEntries] = useState<ProjectDiaryListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  const loadPage = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!orderId) return

      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError('')

      try {
        const result = await fetchProjectDiaryPage(orderId, targetPage)
        setTotal(result.total)
        setHasMore(result.hasMore)
        setPage(result.page)
        setEntries((prev) => (append ? [...prev, ...result.entries] : result.entries))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Načtení stavebního deníku se nezdařilo')
        if (!append) {
          setEntries([])
          setTotal(0)
          setHasMore(false)
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [orderId]
  )

  useEffect(() => {
    setSelectedEntryId(null)
    setPage(1)
    void loadPage(1, false)
  }, [orderId, loadPage])

  function handleLoadMore() {
    if (!hasMore || loadingMore) return
    void loadPage(page + 1, true)
  }

  function handleRetry() {
    void loadPage(1, false)
  }

  function openFullDiary() {
    const basePath = profile && isStavbyvedouci(profile.role) ? '/stavbyvedouci/denik' : '/denik'
    navigate(`${basePath}?orderId=${encodeURIComponent(orderId)}`)
  }

  if (selectedEntryId) {
    return (
      <ProjectDiaryEntryDetail
        entryId={selectedEntryId}
        onClose={() => setSelectedEntryId(null)}
      />
    )
  }

  return (
    <section className="space-y-3 border-t border-white/10 pt-4" aria-labelledby="project-diary-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 id="project-diary-heading" className="flex items-center gap-2 text-base font-semibold text-theme-primary">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Stavební deník
          </h4>
          <p className="mt-1 text-xs text-theme-muted">
            Celkem zápisů: <strong className="text-theme-primary">{total}</strong>
            {total > 0 ? ` · zobrazeno ${entries.length}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={openFullDiary}>
            Otevřít kompletní stavební deník
          </Button>
          {canCreateEntry ? (
            <Button size="sm" onClick={onCreateEntry}>
              <Plus className="h-4 w-4" />
              Přidat zápis
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <p>{error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={handleRetry}>
            <RefreshCw className="h-4 w-4" />
            Zkusit znovu
          </Button>
        </div>
      ) : total === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-theme-muted">
          Pro tuto zakázku zatím není vytvořen žádný zápis stavebního deníku.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <ProjectDiaryEntryCard entry={entry} onSelect={setSelectedEntryId} />
              </li>
            ))}
          </ul>

          {hasMore ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore
                ? 'Načítám…'
                : `Načíst další (${Math.min(PROJECT_DIARY_PAGE_SIZE, total - entries.length)} z ${total - entries.length} zbývá)`}
            </Button>
          ) : null}
        </>
      )}

      <p className="text-xs text-theme-muted">Zakázka: {orderName}</p>
    </section>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BookOpen, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PROJECT_NOTIFICATION_TYPE_LABELS } from '@/constants/projectNotifications'
import { fetchProjectNotifications, runMissingDiaryCheck } from '@/lib/zakazkyMapa/notificationsApi'
import type { ProjectNotification, ProjectNotificationFilters } from '@/types/projectNotifications'

interface ProjectNotificationsPanelProps {
  canRunCheck?: boolean
  diaryFillBasePath?: string
  showResolved?: boolean
}

export function ProjectNotificationsPanel({
  canRunCheck = false,
  diaryFillBasePath = '/stavbyvedouci/denik',
  showResolved = true,
}: ProjectNotificationsPanelProps) {
  const [items, setItems] = useState<ProjectNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [runningCheck, setRunningCheck] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filters, setFilters] = useState<ProjectNotificationFilters>({ isResolved: false })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await fetchProjectNotifications(
        showResolved ? filters : { ...filters, isResolved: false }
      )
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení upozornění se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [filters, showResolved])

  useEffect(() => {
    void load()
  }, [load])

  const unresolvedCount = useMemo(
    () => items.filter((item) => !item.is_resolved).length,
    [items]
  )

  async function handleRunCheck() {
    setRunningCheck(true)
    setError('')
    setSuccess('')
    try {
      const result = await runMissingDiaryCheck()
      setSuccess(
        `Kontrola dokončena: ${result.notifications_created} nových upozornění, ${result.markers_updated} špendlíků aktualizováno.`
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kontrola se nezdařila')
    } finally {
      setRunningCheck(false)
    }
  }

  const statusOptions = [
    { value: 'open', label: 'Aktivní' },
    { value: 'resolved', label: 'Vyřešená' },
    { value: 'all', label: 'Vše' },
  ]

  const statusValue =
    filters.isResolved === false ? 'open' : filters.isResolved === true ? 'resolved' : 'all'

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-theme-primary">Upozornění na chybějící deník</h2>
          <p className="mt-1 text-sm text-theme-muted">
            Nevyřešená: <strong className="text-theme-primary">{unresolvedCount}</strong>
          </p>
        </div>
        {canRunCheck ? (
          <Button
            variant="secondary"
            className="min-h-[44px]"
            disabled={runningCheck}
            onClick={() => void handleRunCheck()}
          >
            <RefreshCw className={`h-4 w-4 ${runningCheck ? 'animate-spin' : ''}`} />
            Spustit kontrolu
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Datum od"
          type="date"
          value={filters.missingDateFrom ?? ''}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              missingDateFrom: event.target.value || undefined,
            }))
          }
        />
        <Input
          label="Datum do"
          type="date"
          value={filters.missingDateTo ?? ''}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              missingDateTo: event.target.value || undefined,
            }))
          }
        />
        {showResolved ? (
          <Select
            label="Stav"
            options={statusOptions}
            value={statusValue}
            onChange={(event) => {
              const value = event.target.value
              setFilters((prev) => ({
                ...prev,
                isResolved: value === 'open' ? false : value === 'resolved' ? true : undefined,
              }))
            }}
          />
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {success ? <p className="text-sm text-green-300">{success}</p> : null}

      {loading ? (
        <p className="text-sm text-theme-muted">Načítám upozornění…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-theme-muted">Žádná upozornění k zobrazení.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border p-3 text-sm ${
                item.is_resolved
                  ? 'border-white/10 bg-white/[0.02] opacity-80'
                  : 'border-amber-500/30 bg-amber-500/10'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-theme-primary">
                    {item.order_name ?? 'Zakázka'}
                    {item.order_location ? ` · ${item.order_location}` : ''}
                  </p>
                  <p className="mt-1 text-theme-secondary">{item.message}</p>
                  <p className="mt-1 text-xs text-theme-muted">
                    {PROJECT_NOTIFICATION_TYPE_LABELS.missing_diary} · {item.missing_date ?? '—'}
                    {item.is_resolved ? ` · vyřešeno ${item.resolved_at?.slice(0, 10) ?? ''}` : ''}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {!item.is_resolved && item.missing_date ? (
                      <Link
                        to={`${diaryFillBasePath}?orderId=${item.project_id}&entryDate=${item.missing_date}`}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-cyan-500/15 px-4 text-sm font-medium text-cyan-200 hover:bg-cyan-500/25"
                      >
                        <BookOpen className="h-4 w-4" />
                        Doplnit deník
                      </Link>
                    ) : null}
                    <Link
                      to={`/zakazky/${item.project_id}`}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-theme-primary hover:bg-white/5"
                    >
                      Detail zakázky
                    </Link>
                    <Link
                      to={`/zakazky-mapa?projectId=${item.project_id}`}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-theme-primary hover:bg-white/5"
                    >
                      <MapPin className="h-4 w-4" />
                      Mapa
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

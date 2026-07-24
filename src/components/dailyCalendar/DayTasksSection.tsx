import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type CalendarTask,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/dailyCalendar/types'

const PRIORITY_OPTIONS = (Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((value) => ({
  value,
  label: TASK_PRIORITY_LABELS[value],
}))

const STATUS_OPTIONS = (Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((value) => ({
  value,
  label: TASK_STATUS_LABELS[value],
}))

const PRIORITY_BADGE_VARIANT: Record<TaskPriority, 'neutral' | 'info' | 'danger'> = {
  nizka: 'neutral',
  stredni: 'info',
  vysoka: 'danger',
}

const STATUS_BADGE_VARIANT: Record<TaskStatus, 'neutral' | 'warning' | 'success'> = {
  nezahajeno: 'neutral',
  probiha: 'warning',
  hotovo: 'success',
}

interface DayTasksSectionProps {
  tasks: CalendarTask[]
  /** Null, dokud denní záznam ještě není uložen v Supabase – bez ID záznamu nelze úkoly přidávat. */
  entryId: string | null
  onAddTask: (task: { title: string; priority: TaskPriority; status: TaskStatus }) => Promise<void>
  onRemoveTask: (taskId: string) => Promise<void>
}

/**
 * Úkoly dne – seznam napojený na Supabase (`daily_calendar_tasks`).
 * Přidávání je možné až poté, co existuje uložený denní záznam (entryId),
 * protože úkol je vždy vázán na konkrétní entry_id.
 */
export function DayTasksSection({ tasks, entryId, onAddTask, onRemoveTask }: DayTasksSectionProps) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('stredni')
  const [status, setStatus] = useState<TaskStatus>('nezahajeno')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    const trimmed = title.trim()
    if (!trimmed || !entryId) return

    setSaving(true)
    setError(null)
    try {
      await onAddTask({ title: trimmed, priority, status })
      setTitle('')
      setPriority('stredni')
      setStatus('nezahajeno')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Úkol se nepodařilo uložit.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(taskId: string) {
    setRemovingId(taskId)
    setError(null)
    try {
      await onRemoveTask(taskId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Úkol se nepodařilo odebrat.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {!entryId && (
        <p className="text-sm text-theme-muted">
          Nejprve vyberte zakázku v sekci „Informace dne" – úkoly lze přidávat až k uloženému dni.
        </p>
      )}

      {tasks.length === 0 && entryId ? (
        <p className="text-sm text-theme-muted">Zatím nejsou přidané žádné úkoly.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-glass)] px-4 py-3"
            >
              <span className="text-sm font-medium text-theme-primary">{task.title}</span>
              <div className="flex items-center gap-2">
                <StatusBadge label={TASK_PRIORITY_LABELS[task.priority]} variant={PRIORITY_BADGE_VARIANT[task.priority]} />
                <StatusBadge label={TASK_STATUS_LABELS[task.status]} variant={STATUS_BADGE_VARIANT[task.status]} />
                <button
                  type="button"
                  onClick={() => handleRemove(task.id)}
                  disabled={removingId === task.id}
                  className="rounded-lg p-1.5 text-theme-muted transition-colors hover:text-red-400 disabled:opacity-50"
                  aria-label={`Odebrat úkol ${task.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <Input
          label="Název úkolu"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Např. Doobjednat materiál"
          disabled={!entryId}
        />
        <Select
          label="Priorita"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          options={PRIORITY_OPTIONS}
          disabled={!entryId}
        />
        <Select
          label="Stav"
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          options={STATUS_OPTIONS}
          disabled={!entryId}
        />
        <Button type="button" onClick={handleAdd} loading={saving} disabled={!entryId} className="shrink-0">
          <Plus className="h-4 w-4" />
          Přidat
        </Button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import { DayInfoSection } from '@/components/dailyCalendar/DayInfoSection'
import { DayTasksSection } from '@/components/dailyCalendar/DayTasksSection'
import { DayNotesSection } from '@/components/dailyCalendar/DayNotesSection'
import { FutureIntegrationsSection } from '@/components/dailyCalendar/FutureIntegrationsSection'
import { createEmptyDailyEntry, type CalendarDayStatus, type DailyCalendarEntry, type TaskPriority, type TaskStatus } from '@/lib/dailyCalendar/types'
import {
  addDailyTask,
  deleteDailyTask,
  fetchActiveOrders,
  fetchMonthEntries,
  upsertDailyEntry,
  type DailyOrderOption,
} from '@/lib/dailyCalendar/api'

/**
 * Denní provozní kalendář – napojení na Supabase.
 *
 * Vyžaduje aplikovanou migraci `supabase/migrations/083_daily_calendar_module.sql`.
 * Dokud migrace není na cílovém Supabase projektu spuštěna, načítání dat
 * skončí srozumitelnou chybovou hláškou místo pádu stránky.
 */

const TIME_ZONE = 'Europe/Prague'

const WEEKDAY_SHORT_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

const WEEKDAY_FULL_LABELS = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota']

const MONTH_LABELS = [
  'Leden',
  'Únor',
  'Březen',
  'Duben',
  'Květen',
  'Červen',
  'Červenec',
  'Srpen',
  'Září',
  'Říjen',
  'Listopad',
  'Prosinec',
]

interface PragueNow {
  year: number
  month: number
  day: number
  weekday: number
  hours: number
  minutes: number
  seconds: number
}

const WEEKDAY_ABBR_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** Zjistí aktuální datum a živý čas v časovém pásmu Europe/Prague, bez ohledu na pásmo zařízení. */
function getPragueNow(): PragueNow {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now)

  const map: Record<string, string> = {}
  for (const part of parts) map[part.type] = part.value

  const hour24 = map.hour === '24' ? 0 : Number(map.hour)

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: WEEKDAY_ABBR_TO_INDEX[map.weekday] ?? now.getDay(),
    hours: hour24,
    minutes: Number(map.minute),
    seconds: Number(map.second),
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Přepočet z JS getDay() (Ne=0..So=6) na index s pondělím na začátku (Po=0..Ne=6). */
function mondayFirstIndex(jsWeekday: number): number {
  return (jsWeekday + 6) % 7
}

interface CalendarCell {
  day: number
  iso: string
  inCurrentMonth: boolean
}

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month - 1, 1)
  const leadingBlanks = mondayFirstIndex(firstOfMonth.getDay())
  const totalDaysCurrent = daysInMonth(year, month)

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const totalDaysPrev = daysInMonth(prevYear, prevMonth)

  const cells: CalendarCell[] = []

  for (let i = leadingBlanks - 1; i >= 0; i--) {
    const day = totalDaysPrev - i
    cells.push({ day, iso: toIso(prevYear, prevMonth, day), inCurrentMonth: false })
  }

  for (let day = 1; day <= totalDaysCurrent; day++) {
    cells.push({ day, iso: toIso(year, month, day), inCurrentMonth: true })
  }

  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  let nextDay = 1
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextDay, iso: toIso(nextYear, nextMonth, nextDay), inCurrentMonth: false })
    nextDay++
  }

  return cells
}

function formatCzDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return `${day}. ${month}. ${year}`
}

export function DailyCalendarPage() {
  const [now, setNow] = useState<PragueNow>(() => getPragueNow())

  useEffect(() => {
    const interval = setInterval(() => setNow(getPragueNow()), 1000)
    return () => clearInterval(interval)
  }, [])

  const todayIso = toIso(now.year, now.month, now.day)

  const [viewYear, setViewYear] = useState(now.year)
  const [viewMonth, setViewMonth] = useState(now.month)
  const [selectedIso, setSelectedIso] = useState<string | null>(null)

  // Denní záznamy načtené ze Supabase (klíč = datum YYYY-MM-DD), doplňované po měsících.
  const [entries, setEntries] = useState<Record<string, DailyCalendarEntry>>({})
  const [monthLoading, setMonthLoading] = useState(false)
  const [monthError, setMonthError] = useState<string | null>(null)

  const [orders, setOrders] = useState<DailyOrderOption[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Načtení aktivních zakázek – jednou při otevření modulu.
  useEffect(() => {
    let cancelled = false
    setOrdersLoading(true)
    fetchActiveOrders()
      .then((data) => {
        if (!cancelled) setOrders(data)
      })
      .catch((err) => {
        if (!cancelled) setOrdersError(err instanceof Error ? err.message : 'Nepodařilo se načíst zakázky.')
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Načtení denních záznamů pro zobrazený měsíc.
  useEffect(() => {
    let cancelled = false
    setMonthLoading(true)
    setMonthError(null)
    fetchMonthEntries(viewYear, viewMonth)
      .then((list) => {
        if (cancelled) return
        setEntries((prev) => {
          const next = { ...prev }
          for (const entry of list) next[entry.date] = entry
          return next
        })
      })
      .catch((err) => {
        if (!cancelled) {
          setMonthError(
            err instanceof Error
              ? err.message
              : 'Nepodařilo se načíst data z databáze. Ujistěte se, že migrace 083_daily_calendar_module.sql byla v Supabase spuštěna.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setMonthLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [viewYear, viewMonth])

  // Úklid rozpracovaného debounce při odchodu ze stránky.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const selectedEntry = selectedIso ? entries[selectedIso] ?? createEmptyDailyEntry(selectedIso) : null

  const persistEntry = useCallback(async (entry: DailyCalendarEntry) => {
    if (!entry.orderId) return
    setSaveStatus('saving')
    setSaveError(null)
    try {
      const saved = await upsertDailyEntry({
        date: entry.date,
        orderId: entry.orderId,
        status: entry.status,
        notes: entry.notes,
        workerCount: entry.workerCount,
      })
      setEntries((prev) => ({
        ...prev,
        [entry.date]: { ...saved, tasks: entry.tasks },
      }))
      setSaveStatus('saved')
    } catch (err) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Uložení se nezdařilo.')
    }
  }, [])

  function updateSelectedEntry(patch: Partial<DailyCalendarEntry>) {
    if (!selectedIso) return
    setEntries((prev) => {
      const current = prev[selectedIso] ?? createEmptyDailyEntry(selectedIso)
      const next = { ...current, ...patch }

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        void persistEntry(next)
      }, 600)

      return { ...prev, [selectedIso]: next }
    })
  }

  async function handleAddTask(task: { title: string; priority: TaskPriority; status: TaskStatus }) {
    if (!selectedIso || !selectedEntry?.id) return
    const newTask = await addDailyTask(selectedEntry.id, task)
    setEntries((prev) => {
      const current = prev[selectedIso] ?? createEmptyDailyEntry(selectedIso)
      return { ...prev, [selectedIso]: { ...current, tasks: [...current.tasks, newTask] } }
    })
  }

  async function handleRemoveTask(taskId: string) {
    if (!selectedIso) return
    await deleteDailyTask(taskId)
    setEntries((prev) => {
      const current = prev[selectedIso]
      if (!current) return prev
      return { ...prev, [selectedIso]: { ...current, tasks: current.tasks.filter((t) => t.id !== taskId) } }
    })
  }

  const goPrevMonth = useCallback(() => {
    setViewMonth((prevMonth) => {
      if (prevMonth === 1) {
        setViewYear((prevYear) => prevYear - 1)
        return 12
      }
      return prevMonth - 1
    })
  }, [])

  const goNextMonth = useCallback(() => {
    setViewMonth((prevMonth) => {
      if (prevMonth === 12) {
        setViewYear((prevYear) => prevYear + 1)
        return 1
      }
      return prevMonth + 1
    })
  }, [])

  const goToday = useCallback(() => {
    setViewYear(now.year)
    setViewMonth(now.month)
    setSelectedIso(todayIso)
  }, [now.year, now.month, todayIso])

  const timeLabel = `${pad2(now.hours)}:${pad2(now.minutes)}:${pad2(now.seconds)}`
  const dateLabel = `${pad2(now.day)}. ${pad2(now.month)}. ${now.year}`
  const weekdayLabel = WEEKDAY_FULL_LABELS[now.weekday]

  return (
    <AppLayout title="Denní provozní kalendář">
      <PageHeader
        title="Denní provozní kalendář"
        description="Přehled provozu po jednotlivých dnech."
      />

      {/* Horní panel: aktuální den, datum a živý čas (Europe/Prague) */}
      <Card className="mb-6 flex flex-col items-center gap-3 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-theme-muted">{weekdayLabel}</p>
          <p className="text-2xl font-bold text-theme-primary sm:text-3xl">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass)] px-4 py-2 font-mono text-3xl font-bold tabular-nums text-[var(--accent-primary)] sm:text-4xl">
            {timeLabel}
          </span>
          <span className="text-xs text-theme-muted">Europe/Prague</span>
        </div>
      </Card>

      {monthError && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{monthError}</span>
        </div>
      )}
      {ordersError && !monthError && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{ordersError}</span>
        </div>
      )}

      {/* Měsíční kalendář */}
      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-theme-primary">
            {MONTH_LABELS[viewMonth - 1]} {viewYear}
            {monthLoading && <span className="ml-2 text-xs font-normal text-theme-muted">Načítám…</span>}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goPrevMonth} aria-label="Předchozí měsíc">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={goToday}>
              <CalendarDays className="h-4 w-4" />
              Dnes
            </Button>
            <Button variant="ghost" size="sm" onClick={goNextMonth} aria-label="Další měsíc">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wide text-theme-muted sm:text-sm">
          {WEEKDAY_SHORT_LABELS.map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((cell) => {
            const isToday = cell.iso === todayIso
            const isSelected = cell.iso === selectedIso
            const hasEntry = Boolean(entries[cell.iso])

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedIso(cell.iso)}
                className={`
                  relative aspect-square rounded-xl border text-sm font-medium transition-colors
                  sm:text-base
                  ${cell.inCurrentMonth ? 'text-theme-primary' : 'text-theme-muted opacity-40'}
                  ${
                    isToday
                      ? 'nav-item-active border-[var(--accent-primary)]'
                      : isSelected
                        ? 'border-[var(--accent-primary)]/60 bg-[var(--bg-glass)]'
                        : 'border-[var(--border-glass)] hover:border-[var(--accent-primary)]/50'
                  }
                `}
              >
                {cell.day}
                {hasEntry && (
                  <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--accent-primary)]" />
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Detail vybraného dne */}
      {selectedIso && selectedEntry && (
        <div className="flex flex-col gap-6">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-theme-primary">
                Informace dne — {formatCzDate(selectedIso)}
              </h3>
              <div className="flex items-center gap-3">
                <AutoSaveIndicator status={saveStatus} errorMessage={saveError} />
                <button
                  type="button"
                  onClick={() => setSelectedIso(null)}
                  className="rounded-lg p-1 text-theme-muted transition-colors hover:text-theme-primary"
                  aria-label="Zavřít detail dne"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <DayInfoSection
              dateLabel={formatCzDate(selectedIso)}
              status={selectedEntry.status}
              onStatusChange={(status: CalendarDayStatus) => updateSelectedEntry({ status })}
              orderId={selectedEntry.orderId}
              onOrderChange={(orderId) => updateSelectedEntry({ orderId })}
              orders={orders}
              ordersLoading={ordersLoading}
            />
          </Card>

          <Card>
            <h3 className="mb-4 text-lg font-semibold text-theme-primary">Úkoly dne</h3>
            <DayTasksSection
              tasks={selectedEntry.tasks}
              entryId={selectedEntry.id}
              onAddTask={handleAddTask}
              onRemoveTask={handleRemoveTask}
            />
          </Card>

          <Card>
            <h3 className="mb-4 text-lg font-semibold text-theme-primary">Poznámky</h3>
            <DayNotesSection value={selectedEntry.notes} onChange={(notes) => updateSelectedEntry({ notes })} />
          </Card>

          <Card>
            <h3 className="mb-1 text-lg font-semibold text-theme-primary">Budoucí napojení</h3>
            <p className="mb-4 text-sm text-theme-secondary">
              Návrhové místo pro pozdější propojení s dalšími moduly (docházka, výkazy, deník, fotografie).
            </p>
            <FutureIntegrationsSection />
          </Card>
        </div>
      )}
    </AppLayout>
  )
}

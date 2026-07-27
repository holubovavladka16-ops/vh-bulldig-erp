import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { OrderDaySummaryCard } from '@/components/dailyCalendar/OrderDaySummaryCard'
import { fetchDaySummaries, fetchMonthSummaryDates } from '@/lib/dailyCalendar/api'
import type { OrderDaySummary } from '@/lib/dailyCalendar/types'

/**
 * Denní provozní kalendář – automatický manažerský přehled firmy.
 *
 * Žádná hodnota v tomto modulu se nezadává ručně. Po kliknutí na datum se
 * zobrazí všechny zakázky, které mají za daný den nějaká data (podle
 * `order_id` + pracovní datum), každá ve vlastní kartě se stavem
 * stavebního deníku, počtem fotografií, náklady, výplatami zaměstnanců
 * a denním součtem. Data počítá a ukládá výhradně databázová strana
 * (migrace 088 – triggery při zpětné opravě zdrojových dat a automatická
 * uzávěrka ve 23:59 Europe/Prague přes pg_cron).
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

  const [datesWithData, setDatesWithData] = useState<Set<string>>(new Set())
  const [monthLoading, setMonthLoading] = useState(false)
  const [monthError, setMonthError] = useState<string | null>(null)

  const [daySummaries, setDaySummaries] = useState<OrderDaySummary[]>([])
  const [dayLoading, setDayLoading] = useState(false)
  const [dayError, setDayError] = useState<string | null>(null)

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  // Tečkové indikátory v mřížce – které dny v měsíci mají alespoň jednu zakázku s daty.
  useEffect(() => {
    let cancelled = false
    setMonthLoading(true)
    setMonthError(null)
    fetchMonthSummaryDates(viewYear, viewMonth)
      .then((dates) => {
        if (!cancelled) setDatesWithData(dates)
      })
      .catch((err) => {
        if (!cancelled) {
          setMonthError(
            err instanceof Error
              ? err.message
              : 'Nepodařilo se načíst data z databáze. Ujistěte se, že migrace 088_daily_calendar_automatic_summary.sql byla v Supabase spuštěna.'
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

  // Automatický přehled zakázek pro vybraný den.
  const loadDaySummaries = useCallback((iso: string) => {
    setDayLoading(true)
    setDayError(null)
    fetchDaySummaries(iso)
      .then(setDaySummaries)
      .catch((err) => {
        setDayError(err instanceof Error ? err.message : 'Nepodařilo se načíst přehled dne.')
      })
      .finally(() => setDayLoading(false))
  }, [])

  useEffect(() => {
    if (selectedIso) loadDaySummaries(selectedIso)
  }, [selectedIso, loadDaySummaries])

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
        description="Automatický manažerský přehled firmy po jednotlivých dnech."
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
            const hasData = datesWithData.has(cell.iso)

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
                {hasData && (
                  <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--accent-primary)]" />
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Automatický přehled zakázek vybraného dne */}
      {selectedIso && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-theme-primary">{formatCzDate(selectedIso)}</h3>
            <button
              type="button"
              onClick={() => setSelectedIso(null)}
              className="rounded-lg p-1 text-theme-muted transition-colors hover:text-theme-primary"
              aria-label="Zavřít přehled dne"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {dayLoading && (
            <Card className="py-10 text-center text-sm text-theme-muted">Načítám přehled dne…</Card>
          )}

          {dayError && !dayLoading && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{dayError}</span>
            </div>
          )}

          {!dayLoading && !dayError && daySummaries.length === 0 && (
            <Card className="py-10 text-center text-sm text-theme-muted">
              Pro tento den zatím nejsou k dispozici žádná data ze zakázek.
            </Card>
          )}

          {!dayLoading &&
            !dayError &&
            daySummaries.map((summary) => <OrderDaySummaryCard key={summary.orderId} summary={summary} />)}
        </div>
      )}
    </AppLayout>
  )
}

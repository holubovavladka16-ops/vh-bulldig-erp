import { supabase } from '@/lib/supabase'
import type {
  CalendarDayStatus,
  CalendarTask,
  DailyCalendarEntry,
  TaskPriority,
  TaskStatus,
} from '@/lib/dailyCalendar/types'

/**
 * Napojení modulu Denní provozní kalendář na Supabase.
 *
 * Vyžaduje aplikovanou migraci `supabase/migrations/083_daily_calendar_module.sql`
 * (tabulky `daily_calendar_entries`, `daily_calendar_tasks`). Dokud migrace není
 * na cílovém Supabase projektu spuštěna, budou volání níže vracet chybu
 * (např. "relation does not exist") – volající strana (DailyCalendarPage)
 * s tím počítá a zobrazí srozumitelnou hlášku, ne pád aplikace.
 */

interface DailyCalendarEntryRow {
  id: string
  entry_date: string
  order_id: string
  status: CalendarDayStatus
  worker_count: number | null
  notes: string
  created_at: string
  updated_at: string
  job_orders?: { name: string } | null
}

interface DailyCalendarTaskRow {
  id: string
  entry_id: string
  title: string
  priority: TaskPriority
  status: TaskStatus
}

export interface DailyOrderOption {
  id: string
  name: string
}

function mapEntryRow(
  row: DailyCalendarEntryRow,
  tasks: CalendarTask[]
): DailyCalendarEntry {
  return {
    id: row.id,
    date: row.entry_date,
    orderId: row.order_id,
    orderName: row.job_orders?.name ?? null,
    status: row.status,
    tasks,
    notes: row.notes,
    workerCount: row.worker_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Načte seznam aktivních zakázek pro výběr v detailu dne. */
export async function fetchActiveOrders(): Promise<DailyOrderOption[]> {
  const { data, error } = await supabase
    .from('job_orders')
    .select('id, name')
    .eq('status', 'aktivni')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as DailyOrderOption[]
}

/** Načte všechny denní záznamy (včetně úkolů) pro zadaný měsíc. */
export async function fetchMonthEntries(year: number, month: number): Promise<DailyCalendarEntry[]> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: entryRows, error: entriesError } = await supabase
    .from('daily_calendar_entries')
    .select('*, job_orders:order_id ( name )')
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: true })

  if (entriesError) throw new Error(entriesError.message)

  const entries = (entryRows ?? []) as DailyCalendarEntryRow[]
  if (entries.length === 0) return []

  const entryIds = entries.map((row) => row.id)
  const { data: taskRows, error: tasksError } = await supabase
    .from('daily_calendar_tasks')
    .select('id, entry_id, title, priority, status')
    .in('entry_id', entryIds)
    .order('created_at', { ascending: true })

  if (tasksError) throw new Error(tasksError.message)

  const tasksByEntry = new Map<string, CalendarTask[]>()
  for (const row of (taskRows ?? []) as DailyCalendarTaskRow[]) {
    const list = tasksByEntry.get(row.entry_id) ?? []
    list.push({ id: row.id, title: row.title, priority: row.priority, status: row.status })
    tasksByEntry.set(row.entry_id, list)
  }

  return entries.map((row) => mapEntryRow(row, tasksByEntry.get(row.id) ?? []))
}

export interface UpsertDailyEntryParams {
  date: string
  orderId: string
  status: CalendarDayStatus
  notes: string
  workerCount: number | null
}

/** Vytvoří nebo upraví denní záznam pro kombinaci datum + zakázka a vrátí jeho aktuální stav. */
export async function upsertDailyEntry(params: UpsertDailyEntryParams): Promise<DailyCalendarEntry> {
  const { data, error } = await supabase
    .from('daily_calendar_entries')
    .upsert(
      {
        entry_date: params.date,
        order_id: params.orderId,
        status: params.status,
        notes: params.notes,
        worker_count: params.workerCount,
      },
      { onConflict: 'entry_date,order_id' }
    )
    .select('*, job_orders:order_id ( name )')
    .single()

  if (error) throw new Error(error.message)
  return mapEntryRow(data as DailyCalendarEntryRow, [])
}

/** Přidá nový úkol k danému dennímu záznamu (záznam musí již v databázi existovat). */
export async function addDailyTask(
  entryId: string,
  task: { title: string; priority: TaskPriority; status: TaskStatus }
): Promise<CalendarTask> {
  const { data, error } = await supabase
    .from('daily_calendar_tasks')
    .insert({ entry_id: entryId, title: task.title, priority: task.priority, status: task.status })
    .select('id, entry_id, title, priority, status')
    .single()

  if (error) throw new Error(error.message)
  const row = data as DailyCalendarTaskRow
  return { id: row.id, title: row.title, priority: row.priority, status: row.status }
}

/** Smaže úkol dne. */
export async function deleteDailyTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('daily_calendar_tasks').delete().eq('id', taskId)
  if (error) throw new Error(error.message)
}

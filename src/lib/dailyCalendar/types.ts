/**
 * Denní provozní kalendář – FÁZE 4: připravená datová struktura.
 *
 * Tyto typy zatím popisují pouze tvar dat na frontendu. Nejsou napojené
 * na žádnou tabulku v Supabase, nevznikla k nim žádná migrace ani SQL.
 * Slouží jako příprava pro budoucí reálné napojení (viz futureIntegrations.ts).
 */

/** Stav dne v kalendáři – zatím nastavovaný pouze ručně na frontendu. */
export type CalendarDayStatus = 'planovano' | 'probiha' | 'hotovo' | 'chybi_udaje'

export const CALENDAR_DAY_STATUS_LABELS: Record<CalendarDayStatus, string> = {
  planovano: 'Plánováno',
  probiha: 'Probíhá',
  hotovo: 'Hotovo',
  chybi_udaje: 'Chybí údaje',
}

/** Priorita úkolu dne. */
export type TaskPriority = 'nizka' | 'stredni' | 'vysoka'

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  nizka: 'Nízká',
  stredni: 'Střední',
  vysoka: 'Vysoká',
}

/** Stav úkolu dne. */
export type TaskStatus = 'nezahajeno' | 'probiha' | 'hotovo'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  nezahajeno: 'Nezahájeno',
  probiha: 'Probíhá',
  hotovo: 'Hotovo',
}

/** Jeden úkol v rámci konkrétního dne. Zatím pouze v paměti frontendu. */
export interface CalendarTask {
  id: string
  title: string
  priority: TaskPriority
  status: TaskStatus
}

/**
 * Denní záznam kalendáře – připravená struktura pro budoucí napojení
 * na zakázky, docházku, výkazy, stavební deník a GPS fotografie.
 *
 * `orderId`/`orderName` zatím zůstávají prázdné – výběr reálné zakázky
 * bude doplněn až při skutečném napojení na modul Zakázky (job_orders).
 */
export interface DailyCalendarEntry {
  /** ID záznamu v Supabase (`daily_calendar_entries.id`). Null, dokud není poprvé uložen. */
  id: string | null
  /** Datum ve formátu YYYY-MM-DD. */
  date: string
  /** Budoucí vazba na job_orders.id – zatím vždy null. */
  orderId: string | null
  /** Zobrazovaný název zakázky – zatím vždy null. */
  orderName: string | null
  status: CalendarDayStatus
  tasks: CalendarTask[]
  notes: string
  /** Počet pracovníků – zatím zadávaný ručně, později odvozený z docházky. */
  workerCount: number | null
  /** ISO čas vytvoření záznamu na frontendu (ne z databáze). */
  createdAt: string
  /** ISO čas poslední úpravy záznamu na frontendu (ne z databáze). */
  updatedAt: string
}

/** Vytvoří prázdný, výchozí denní záznam pro zadané datum. */
export function createEmptyDailyEntry(date: string): DailyCalendarEntry {
  const now = new Date().toISOString()
  return {
    id: null,
    date,
    orderId: null,
    orderName: null,
    status: 'planovano',
    tasks: [],
    notes: '',
    workerCount: null,
    createdAt: now,
    updatedAt: now,
  }
}

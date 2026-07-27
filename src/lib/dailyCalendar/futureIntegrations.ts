/**
 * Denní provozní kalendář – FÁZE 4: návrhové místo pro budoucí napojení.
 *
 * Tento soubor pouze POJMENOVÁVÁ existující tabulky, se kterými bude
 * modul v budoucnu pracovat. Neobsahuje žádné dotazy do Supabase,
 * žádné SQL a nic z databáze zatím nenačítá.
 */

export interface FutureIntegrationSource {
  id: string
  label: string
  /** Název existující tabulky v Supabase, na kterou se bude v budoucnu napojovat. */
  table: string
  description: string
  /** True, pokud je toto napojení již reálně použité (např. výběr zakázky v detailu dne). */
  connected: boolean
}

export const FUTURE_INTEGRATION_SOURCES: FutureIntegrationSource[] = [
  {
    id: 'zakazky',
    label: 'Zakázky',
    table: 'job_orders',
    description: 'Výběr zakázky pro denní záznam je již napojen (viz sekce Informace dne).',
    connected: true,
  },
  {
    id: 'dochazka',
    label: 'Docházka',
    table: 'worker_attendance_records',
    description: 'Počet pracovníků a odpracovaný čas za daný den.',
    connected: false,
  },
  {
    id: 'vykazy',
    label: 'Výkazy',
    table: 'worker_reports',
    description: 'Pracovní výkon a výdělky za daný den.',
    connected: false,
  },
  {
    id: 'denik',
    label: 'Stavební deník',
    table: 'construction_diary_entries',
    description: 'Stav a obsah zápisu ve stavebním deníku.',
    connected: false,
  },
  {
    id: 'gps-fotografie',
    label: 'GPS fotografie',
    table: 'gps_photos',
    description: 'Počet a přehled fotografií pořízených daný den.',
    connected: false,
  },
]

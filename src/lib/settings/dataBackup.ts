import {
  EXPORT_TABLES,
  PRESERVED_ENTITIES,
  SAFE_TEST_DATA_TABLES,
  STORAGE_PATH_SOURCES,
  TEST_DATA_CONFIRM_PHRASE,
} from '@/constants/dataBackup'
import { downloadCsv } from '@/lib/export'
import { supabase } from '@/lib/supabase'

export interface TableAuditResult {
  table: string
  count: number | null
  error?: string
}

export interface DataBackupAudit {
  deletableTables: TableAuditResult[]
  preservedTables: TableAuditResult[]
  totalDeletableRows: number
  exportedAt: string
}

export interface CleanupResult {
  deletedTables: Record<string, number>
  skippedTables: string[]
  deletedStorageFiles: number
  errors: string[]
}

function flattenRow(row: Record<string, unknown>): string[] {
  return Object.values(row).map((value) => {
    if (value == null) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  })
}

async function countTable(table: string): Promise<TableAuditResult> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) {
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      return { table, count: null, error: 'Tabulka neexistuje' }
    }
    return { table, count: null, error: error.message }
  }
  return { table, count: count ?? 0 }
}

export async function auditDataBackup(): Promise<DataBackupAudit> {
  const deletableTables = await Promise.all(SAFE_TEST_DATA_TABLES.map((table) => countTable(table)))
  const preservedTables = await Promise.all(PRESERVED_ENTITIES.map((table) => countTable(table)))

  const totalDeletableRows = deletableTables.reduce((sum, item) => sum + (item.count ?? 0), 0)

  return {
    deletableTables,
    preservedTables,
    totalDeletableRows,
    exportedAt: new Date().toISOString(),
  }
}

async function fetchTableRows(table: string): Promise<Record<string, unknown>[]> {
  const pageSize = 1000
  let from = 0
  const rows: Record<string, unknown>[] = []

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1)

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) return []
      throw new Error(`${table}: ${error.message}`)
    }

    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return rows
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

export async function exportDatabaseJson(): Promise<void> {
  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    tables: {} as Record<string, unknown[]>,
  }

  for (const table of EXPORT_TABLES) {
    payload.tables = payload.tables as Record<string, unknown[]>
    ;(payload.tables as Record<string, unknown[]>)[table] = await fetchTableRows(table)
  }

  downloadJson(`erp-export-databaze_${stamp()}.json`, payload)
}

export async function exportAllDataExcel(): Promise<void> {
  for (const table of EXPORT_TABLES) {
    const rows = await fetchTableRows(table)
    if (rows.length === 0) continue

    const headers = Object.keys(rows[0]!)
    downloadCsv(
      `erp-export_${table}_${stamp()}.csv`,
      headers,
      rows.map((row) => flattenRow(row))
    )

    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

async function collectStoragePaths(): Promise<Array<{ bucket: string; path: string }>> {
  const paths: Array<{ bucket: string; path: string }> = []

  for (const source of STORAGE_PATH_SOURCES) {
    const { data, error } = await supabase.from(source.table).select(source.column)
    if (error) continue

    for (const row of data ?? []) {
      const path = (row as Record<string, string | null>)[source.column]
      if (path) paths.push({ bucket: source.bucket, path })
    }
  }

  return paths
}

async function deleteStoragePaths(paths: Array<{ bucket: string; path: string }>): Promise<number> {
  const byBucket = new Map<string, string[]>()
  for (const { bucket, path } of paths) {
    const list = byBucket.get(bucket) ?? []
    list.push(path)
    byBucket.set(bucket, list)
  }

  let deleted = 0
  for (const [bucket, files] of byBucket) {
    const unique = [...new Set(files)]
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100)
      const { error } = await supabase.storage.from(bucket).remove(chunk)
      if (!error) deleted += chunk.length
    }
  }

  return deleted
}

async function deleteAllFromTable(table: string): Promise<number> {
  const audit = await countTable(table)
  if (!audit.count || audit.count <= 0) return 0

  const { error } = await supabase.from(table).delete().gte('created_at', '1970-01-01')
  if (error) {
    const { error: fallbackError } = await supabase.from(table).delete().not('id', 'is', null)
    if (fallbackError) throw new Error(fallbackError.message)
  }

  return audit.count
}

export async function deleteTestData(confirmPhrase: string): Promise<CleanupResult> {
  if (confirmPhrase !== TEST_DATA_CONFIRM_PHRASE) {
    throw new Error(`Pro potvrzení zadejte přesně: ${TEST_DATA_CONFIRM_PHRASE}`)
  }

  const deletedTables: Record<string, number> = {}
  const skippedTables: string[] = []
  const errors: string[] = []

  try {
    const storagePaths = await collectStoragePaths()
    const deletedStorageFiles = await deleteStoragePaths(storagePaths)

    for (const table of SAFE_TEST_DATA_TABLES) {
      if ((PRESERVED_ENTITIES as readonly string[]).includes(table)) {
        skippedTables.push(`${table}: chráněná tabulka`)
        continue
      }

      try {
        const deleted = await deleteAllFromTable(table)
        if (deleted > 0) deletedTables[table] = deleted
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        skippedTables.push(`${table}: ${message}`)
        errors.push(`${table}: ${message}`)
      }
    }

    return { deletedTables, skippedTables, deletedStorageFiles, errors }
  } catch (err) {
    throw err instanceof Error ? err : new Error('Mazání testovacích dat se nezdařilo')
  }
}

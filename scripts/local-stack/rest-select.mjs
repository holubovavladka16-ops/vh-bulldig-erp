/**
 * Parsování PostgREST select parametru včetně embedů (job_orders, workers).
 */

const DEFAULT_FK = {
  job_orders: 'order_id',
  workers: 'worker_id',
}

const TABLE_FK = {
  job_costs: { job_orders: 'order_id' },
  receipts: { job_orders: 'order_id' },
  construction_diary_entries: { job_orders: 'order_id' },
  gps_photos: { job_orders: 'order_id', workers: 'worker_id' },
  utility_connections: { job_orders: 'order_id', workers: 'worker_id' },
  worker_attendance_records: { workers: 'worker_id' },
  worker_reports: { workers: 'worker_id' },
  worker_daily_forms: { workers: 'worker_id' },
  job_order_invoices: { job_orders: 'order_id' },
}

function inferFkColumn(table, relName) {
  return TABLE_FK[table]?.[relName] ?? DEFAULT_FK[relName] ?? `${relName.replace(/s$/, '')}_id`
}

function splitSelectParts(selectParam) {
  const normalized = selectParam.replace(/\s+/g, ' ').trim()
  const parts = []
  let current = ''
  let depth = 0

  for (const char of normalized) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  if (current.trim()) parts.push(current.trim())
  return parts
}

export function parseSelectClause(selectParam, table) {
  if (!selectParam || selectParam === '*') {
    return { baseStar: true, baseColumns: [], embeds: [] }
  }

  const parts = splitSelectParts(selectParam)
  const baseColumns = []
  const embeds = []
  let baseStar = false

  for (const part of parts) {
    const embedMatch = part.match(/^([\w]+)(?::([\w]+))?\((.+)\)$/)
    if (embedMatch) {
      const relName = embedMatch[1]
      const fkColumn = embedMatch[2] || inferFkColumn(table, relName)
      const relTable = relName === 'job_orders' || relName === 'workers' ? relName : relName
      embeds.push({
        relName,
        relTable,
        fkColumn,
        columns: embedMatch[3]
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      })
      continue
    }

    if (part === '*') {
      baseStar = true
      continue
    }

    baseColumns.push(part.replace(/"/g, ''))
  }

  return { baseStar: baseStar || baseColumns.length === 0, baseColumns, embeds }
}

export function buildSelectSql(table, { baseStar, baseColumns }) {
  if (baseStar) return '*'
  return baseColumns.map((c) => `"${c}"`).join(', ')
}

export async function enrichRowsWithEmbeds(client, rows, embeds) {
  if (!embeds.length || !rows.length) return rows

  for (const embed of embeds) {
    const colList = embed.columns.map((c) => `"${c}"`).join(', ')
    const fkValues = [...new Set(rows.map((row) => row[embed.fkColumn]).filter(Boolean))]

    if (fkValues.length === 0) {
      for (const row of rows) row[embed.relName] = null
      continue
    }

    const relResult = await client.query(
      `SELECT id, ${colList} FROM "${embed.relTable}" WHERE id = ANY($1::uuid[])`,
      [fkValues]
    )

    const relMap = new Map(relResult.rows.map((relRow) => [relRow.id, relRow]))

    for (const row of rows) {
      const fk = row[embed.fkColumn]
      const relRow = fk ? relMap.get(fk) : null
      if (!relRow) {
        row[embed.relName] = null
        continue
      }
      const nested = {}
      for (const col of embed.columns) {
        nested[col] = relRow[col]
      }
      row[embed.relName] = nested
    }
  }

  return rows
}

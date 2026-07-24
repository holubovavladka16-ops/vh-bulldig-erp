import jwt from 'jsonwebtoken'
import { writeCorsHeaders } from './cors.mjs'
import { buildSelectSql, enrichRowsWithEmbeds, parseSelectClause } from './rest-select.mjs'

const FILTER_OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in'])

export function parseJwtFromRequest(req, jwtSecret) {
  const authHeader = req.headers.authorization ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const token = bearer || req.headers.apikey || ''
  if (!token) return { role: 'anon', sub: null }

  try {
    const payload = jwt.verify(token, jwtSecret)
    return {
      role: payload.role === 'service_role' ? 'service_role' : payload.role === 'anon' ? 'anon' : 'authenticated',
      sub: payload.sub ?? null,
      email: payload.email ?? null,
    }
  } catch {
    return { role: 'anon', sub: null }
  }
}

async function applySession(client, auth) {
  await client.query('BEGIN')
  const role = auth.role === 'service_role' ? 'service_role' : auth.role === 'authenticated' ? 'authenticated' : 'anon'
  await client.query(`SET LOCAL ROLE ${role}`)
  if (auth.sub) {
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [auth.sub])
  }
  if (auth.role) {
    await client.query(`SELECT set_config('request.jwt.claim.role', $1, true)`, [auth.role])
  }
}

function parseSelectParam(selectParam, table) {
  return parseSelectClause(selectParam, table)
}

function formatRpcResponse(rows) {
  if (rows.length === 0) return null
  if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
    return Object.values(rows[0])[0]
  }
  return rows
}

function parseFilters(searchParams, startIndex = 1) {
  const filters = []
  const values = []
  let index = startIndex

  for (const [column, rawValue] of searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset'].includes(column)) continue

    const match = rawValue.match(/^(eq|neq|gt|gte|lt|lte|like|ilike|is|in)\.(.*)$/s)
    if (!match) continue

    const op = match[1]
    const valueRaw = match[2]
    const value = valueRaw === 'null' ? null : valueRaw.replace(/^"|"$/g, '')

    if (op === 'in') {
      const items = value
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((item) => item.trim().replace(/^"|"$/g, ''))
      filters.push(`"${column}" = ANY($${index}::text[])`)
      values.push(items)
    } else if (op === 'is') {
      filters.push(value === 'null' ? `"${column}" IS NULL` : `"${column}" IS NOT NULL`)
    } else if (op === 'ilike') {
      filters.push(`"${column}" ILIKE $${index}`)
      values.push(value)
    } else {
      const sqlOp =
        op === 'eq'
          ? '='
          : op === 'neq'
            ? '<>'
            : op === 'gt'
              ? '>'
              : op === 'gte'
                ? '>='
                : op === 'lt'
                  ? '<'
                  : op === 'lte'
                    ? '<='
                    : 'LIKE'
      filters.push(`"${column}" ${sqlOp} $${index}`)
      values.push(value)
    }
    index += 1
  }

  return { where: filters.length ? `WHERE ${filters.join(' AND ')}` : '', values }
}

function parseOrder(searchParams) {
  const order = searchParams.get('order')
  if (!order) return ''
  const parts = order.split(',').map((part) => {
    const trimmed = part.trim()
    const desc = trimmed.endsWith('.desc')
    const column = desc ? trimmed.slice(0, -5) : trimmed.replace(/\.asc$/, '')
    return `"${column.replace(/"/g, '')}" ${desc ? 'DESC' : 'ASC'}`
  })
  return parts.length ? `ORDER BY ${parts.join(', ')}` : ''
}

export async function handleRestRequest(req, res, url, pgPool, jwtSecret) {
  const auth = parseJwtFromRequest(req, jwtSecret)
  const path = url.pathname.replace(/^\/rest\/v1\/?/, '')
  const segments = path.split('/').filter(Boolean)

  if (segments[0] === 'rpc' && segments[1] && req.method === 'POST') {
    const fnName = segments[1]
    const body = await readBody(req)
    const params = body ? JSON.parse(body) : {}
    const client = await pgPool.connect()
    try {
      await applySession(client, auth)
      const keys = Object.keys(params)
      const args = keys.map((_, i) => `$${i + 1}`).join(', ')
      const sql = keys.length ? `SELECT * FROM ${fnName}(${args}) AS result` : `SELECT * FROM ${fnName}() AS result`
      const result = await client.query(sql, keys.map((key) => params[key]))
      await client.query('COMMIT')
      sendJson(res, 200, formatRpcResponse(result.rows))
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      sendJson(res, 400, { message: error.message, code: 'P0001' })
    } finally {
      client.release()
    }
    return
  }

  const table = segments[0]
  if (!table) {
    sendJson(res, 200, { message: 'VH Bulldig REST gateway' })
    return
  }

  const client = await pgPool.connect()
  try {
    await applySession(client, auth)
    const searchParams = url.searchParams
    const selectClause = parseSelectParam(searchParams.get('select'), table)
    const select = buildSelectSql(table, selectClause)
    const { where, values } = parseFilters(searchParams)
    const order = parseOrder(searchParams)
    const limit = searchParams.get('limit') ? `LIMIT ${Number(searchParams.get('limit'))}` : ''
    const preferSingle = String(req.headers.prefer ?? '').includes('return=representation')
    const wantsCount = String(req.headers.prefer ?? '').includes('count=exact')

    if (req.method === 'HEAD' || (req.method === 'GET' && wantsCount && searchParams.get('select') === 'id')) {
      const countSql = `SELECT COUNT(*)::int AS count FROM "${table}" ${where}`.trim()
      const countResult = await client.query(countSql, values)
      const total = countResult.rows[0]?.count ?? 0
      await client.query('COMMIT')
      writeCorsHeaders(res, 200, {
        'Content-Type': 'application/json',
        'Content-Range': `0-${Math.max(total - 1, 0)}/${total}`,
      })
      res.end()
      return
    }

    if (req.method === 'GET') {
      const sql = `SELECT ${select} FROM "${table}" ${where} ${order} ${limit}`.trim()
      const result = await client.query(sql, values)
      let rows = result.rows
      if (selectClause.embeds.length) {
        rows = await enrichRowsWithEmbeds(client, rows, selectClause.embeds)
      }
      await client.query('COMMIT')
      const wantsObject = String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json')
      if (wantsObject || preferSingle) {
        sendJson(res, 200, rows[0] ?? null)
        return
      }
      if (wantsCount) {
        writeCorsHeaders(res, 200, {
          'Content-Type': 'application/json',
          'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
        })
        res.end(JSON.stringify(rows))
        return
      }
      sendJson(res, 200, rows)
      return
    }

    const rawBody = req.method === 'GET' || req.method === 'HEAD' ? '' : await readBody(req)
    const body =
      rawBody && req.method !== 'DELETE'
        ? JSON.parse(rawBody)
        : null

    if (req.method === 'POST') {
      const columns = Object.keys(body ?? {})
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
      const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`
      const result = await client.query(sql, columns.map((c) => body[c]))
      await client.query('COMMIT')
      sendJson(res, 201, preferSingle ? result.rows[0] : result.rows)
      return
    }

    if (req.method === 'PATCH') {
      const columns = Object.keys(body ?? {})
      const assignments = columns.map((c, i) => `"${c}" = $${i + 1}`).join(', ')
      const filterStart = columns.length + 1
      const { where: patchWhere, values: patchValues } = parseFilters(searchParams, filterStart)
      const sql = `UPDATE "${table}" SET ${assignments} ${patchWhere} RETURNING *`
      const result = await client.query(sql, [...columns.map((c) => body[c]), ...patchValues])
      await client.query('COMMIT')
      sendJson(res, 200, preferSingle ? result.rows[0] : result.rows)
      return
    }

    if (req.method === 'DELETE') {
      const sql = `DELETE FROM "${table}" ${where} RETURNING *`
      const result = await client.query(sql, values)
      await client.query('COMMIT')
      sendJson(res, 200, preferSingle ? result.rows[0] : result.rows)
      return
    }

    sendJson(res, 405, { message: 'Method not allowed' })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    sendJson(res, 400, { message: error.message, code: 'PGRST000' })
  } finally {
    client.release()
  }
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolvePromise(chunks.length ? Buffer.concat(chunks).toString('utf8') : ''))
    req.on('error', reject)
  })
}

function serializeValue(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue)
  }
  if (value && typeof value === 'object') {
    return serializeRow(value)
  }
  return value
}

function serializeRow(row) {
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = serializeValue(value)
  }
  return out
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, (_key, value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value))
  writeCorsHeaders(res, status, { 'Content-Type': 'application/json' })
  res.end(body)
}

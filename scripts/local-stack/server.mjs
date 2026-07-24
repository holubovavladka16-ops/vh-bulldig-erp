import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import jwt from 'jsonwebtoken'
import EmbeddedPostgres from 'embedded-postgres'
import { handleRestRequest } from './rest-gateway.mjs'
import { createStorageHandler } from './storage.mjs'
import { writeDevelopmentEnv } from './env-files.mjs'
import { getPrimaryLanIPv4, printNetworkAccessInfo } from './network.mjs'
import { CORS_ALLOW_HEADERS, CORS_ALLOW_METHODS, writeCorsHeaders } from './cors.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const STACK_DIR = join(ROOT, '.local-stack')
const PG_DIR = join(STACK_DIR, 'pg-data')
const ENV_FILE = join(STACK_DIR, 'runtime.env.json')

const PG_PORT = 55321
const GATEWAY_PORT = 54321
const PG_PASSWORD = 'postgres'
const DB_NAME = 'vh_bulldig'
const JWT_SECRET = 'vh-bulldig-local-development-secret-key!!'

function loadEnvFile(filename) {
  const path = resolve(ROOT, filename)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? 'admin@vhbulldig.cz'
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD ?? 'VhBulldig2026!'
const withVite = process.argv.includes('--with-vite')

function resolveApiBaseUrl() {
  const lanIp = getPrimaryLanIPv4()
  return lanIp ? `http://${lanIp}:${GATEWAY_PORT}` : `http://127.0.0.1:${GATEWAY_PORT}`
}

function buildRuntimeRecord(anonKey) {
  const lanIp = getPrimaryLanIPv4()
  return {
    url: resolveApiBaseUrl(),
    anonKey,
    adminEmail,
    adminPassword,
    lanIp,
    gatewayPort: GATEWAY_PORT,
    appPort: 5173,
  }
}

function createAnonKey() {
  return jwt.sign(
    { role: 'anon', iss: 'supabase-local', iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: '10y' }
  )
}

function createAccessToken(user) {
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      sub: user.id,
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'supabase-local',
      email: user.email,
      iat: now,
      exp: now + 3600,
    },
    JWT_SECRET
  )
}

function createRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' })
}

function buildUserPayload(row, profile) {
  return {
    id: row.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: row.email,
    email_confirmed_at: row.email_confirmed_at,
    phone: '',
    confirmed_at: row.email_confirmed_at,
    last_sign_in_at: new Date().toISOString(),
    app_metadata: row.raw_app_meta_data ?? {},
    user_metadata: row.raw_user_meta_data ?? {},
    identities: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_anonymous: false,
    profile_role: profile?.role,
    full_name: profile?.full_name,
  }
}

async function startDatabase() {
  mkdirSync(STACK_DIR, { recursive: true })
  const pgInstance = new EmbeddedPostgres({
    databaseDir: PG_DIR,
    user: 'postgres',
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  })

  if (!existsSync(PG_DIR)) {
    await pgInstance.initialise()
  }
  await pgInstance.start()

  const client = new pg.Client({
    host: '127.0.0.1',
    port: PG_PORT,
    user: 'postgres',
    password: PG_PASSWORD,
    database: 'postgres',
  })
  await client.connect()

  const dbExists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME])
  if (dbExists.rowCount === 0) {
    await client.query(`CREATE DATABASE ${DB_NAME}`)
  }
  await client.end()

  return pgInstance
}

async function initializeSchema() {
  const client = new pg.Client({
    host: '127.0.0.1',
    port: PG_PORT,
    user: 'postgres',
    password: PG_PASSWORD,
    database: DB_NAME,
  })
  await client.connect()

  const { rows } = await client.query(
    "SELECT to_regclass('public.profiles') IS NOT NULL AS ready"
  )
  if (!rows[0].ready) {
    console.log('Aplikuji migrace do lokální databáze…')
    const bootstrap = readFileSync(join(__dirname, 'bootstrap.sql'), 'utf8')
    const migrations = readFileSync(join(ROOT, 'supabase/apply-all-migrations.sql'), 'utf8')
    await client.query(bootstrap)
    await client.query(migrations)
    console.log('Migrace dokončeny.')
  }

  await client.query(`
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS _local_stack_patches (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `)

  const pendingPatches = ['020_portal_grants_attendance', '021_workers_admin_write_rls', '022_module_profit_overview', '023_grants_new_tables']
  for (const patchName of pendingPatches) {
    const applied = await client.query('SELECT 1 FROM _local_stack_patches WHERE name = $1', [patchName])
    if (applied.rowCount > 0) continue
    const patchPath = join(ROOT, `supabase/migrations/${patchName}.sql`)
    if (!existsSync(patchPath)) continue
    console.log(`Aplikuji lokální patch ${patchName}…`)
    await client.query(readFileSync(patchPath, 'utf8'))
    await client.query('INSERT INTO _local_stack_patches (name) VALUES ($1)', [patchName])
  }

  await client.query(`
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
  `)

  const { rows: bootstrapRows } = await client.query('SELECT system_needs_bootstrap() AS needed')
  if (bootstrapRows[0].needed) {
    console.log(`Vytvářím administrátora ${adminEmail}…`)
    await client.query('SELECT bootstrap_first_admin($1, $2, $3)', [
      adminEmail,
      adminPassword,
      'Administrátor',
    ])
  }

  await client.end()
}

function readJsonBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      if (chunks.length === 0) return resolvePromise({})
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function readRawBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolvePromise(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  writeCorsHeaders(res, status, {
    'Content-Type': 'application/json',
    ...extraHeaders,
  })
  res.end(body)
}

async function handleAuth(req, res, url, pgPool) {
  if (req.method === 'OPTIONS') {
    writeCorsHeaders(res, 204)
    res.end()
    return
  }

  if (req.method === 'POST' && url.pathname === '/auth/v1/token') {
    const body = await readJsonBody(req)
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    const result = await pgPool.query(
      `SELECT u.*, p.role AS profile_role, p.full_name, p.is_active
       FROM auth.users u
       LEFT JOIN public.profiles p ON p.id = u.id
       WHERE lower(u.email) = $1
       LIMIT 1`,
      [email]
    )

    if (result.rowCount === 0) {
      sendJson(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
      return
    }

    const row = result.rows[0]
    const valid = await pgPool.query('SELECT crypt($1, $2) = $2 AS ok', [password, row.encrypted_password])
    if (!valid.rows[0].ok || row.is_active === false || row.banned_until) {
      sendJson(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
      return
    }

    const user = buildUserPayload(row, row)
    const accessToken = createAccessToken(row)
    const refreshToken = createRefreshToken(row)
    sendJson(res, 200, {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: refreshToken,
      user,
    })
    return
  }

  if (req.method === 'GET' && url.pathname === '/auth/v1/user') {
    const authHeader = req.headers.authorization ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      const result = await pgPool.query(
        `SELECT u.*, p.role AS profile_role, p.full_name, p.is_active
         FROM auth.users u
         LEFT JOIN public.profiles p ON p.id = u.id
         WHERE u.id = $1`,
        [payload.sub]
      )
      if (result.rowCount === 0) {
        sendJson(res, 401, { error: 'invalid_jwt' })
        return
      }
      sendJson(res, 200, buildUserPayload(result.rows[0], result.rows[0]))
    } catch {
      sendJson(res, 401, { error: 'invalid_jwt' })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/auth/v1/logout') {
    sendJson(res, 204, {})
    return
  }

  sendJson(res, 404, { message: 'Auth route not found' })
}

const { handleStorage } = createStorageHandler(join(STACK_DIR, 'storage'))

function startGateway(pgPool, anonKey) {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${GATEWAY_PORT}`)

    if (req.method === 'OPTIONS') {
      writeCorsHeaders(res, 204)
      res.end()
      return
    }

    if (url.pathname.startsWith('/auth/v1')) {
      await handleAuth(req, res, url, pgPool)
      return
    }

    if (url.pathname.startsWith('/rest/v1')) {
      if (!req.headers.apikey) req.headers.apikey = anonKey
      await handleRestRequest(req, res, url, pgPool, JWT_SECRET)
      return
    }

    if (url.pathname.startsWith('/storage/v1')) {
      await handleStorage(req, res, url)
      return
    }

    sendJson(res, 200, {
      message: 'VH Bulldig local Supabase stack',
      rest: `http://127.0.0.1:${GATEWAY_PORT}/rest/v1`,
      auth: `http://127.0.0.1:${GATEWAY_PORT}/auth/v1`,
      storage: `http://127.0.0.1:${GATEWAY_PORT}/storage/v1`,
    })
  })
}

function startVite(anonKey) {
  const runtime = buildRuntimeRecord(anonKey)
  writeDevelopmentEnv(runtime)
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const child = spawn(npmCmd, ['run', 'dev'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  })
  child.on('exit', (code) => process.exit(code ?? 0))
  return child
}

async function main() {
  mkdirSync(STACK_DIR, { recursive: true })
  const anonKey = createAnonKey()
  const runtime = buildRuntimeRecord(anonKey)
  writeFileSync(ENV_FILE, JSON.stringify(runtime, null, 2))

  writeDevelopmentEnv(runtime)

  spawnSync('node', ['scripts/build-apply-all-sql.mjs'], { cwd: ROOT, stdio: 'inherit', shell: true })

  const pgInstance = await startDatabase()
  await initializeSchema()

  const pgPool = new pg.Pool({
    host: '127.0.0.1',
    port: PG_PORT,
    user: 'postgres',
    password: PG_PASSWORD,
    database: DB_NAME,
  })

  const gateway = startGateway(pgPool, anonKey)
  await new Promise((resolvePromise) => gateway.listen(GATEWAY_PORT, '0.0.0.0', resolvePromise))

  console.log('')
  console.log('=== LOKÁLNÍ ERP STACK BĚŽÍ ===')
  console.log(`API (LAN):        ${runtime.url}`)
  console.log(`E-mail admina:    ${adminEmail}`)
  console.log(`Heslo admina:     ${adminPassword}`)
  printNetworkAccessInfo({ lanIp: runtime.lanIp, apiPort: GATEWAY_PORT })

  if (withVite) {
    writeDevelopmentEnv(runtime)
    startVite(anonKey)
  } else {
    console.log('Spusťte frontend: npm run dev:local:app')
  }

  const shutdown = async () => {
    gateway.close()
    await pgPool.end()
    await pgInstance.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  console.error('FAIL:', error?.message ?? error)
  process.exit(1)
})

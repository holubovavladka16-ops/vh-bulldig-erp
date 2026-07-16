import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import pg from 'pg'
import EmbeddedPostgres from 'embedded-postgres'

const { Client } = pg
const sqlFile = resolve(process.cwd(), 'supabase/apply-all-migrations.sql')

const supabaseBootstrap = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS auth.users (
  instance_id UUID,
  id UUID PRIMARY KEY,
  aud TEXT,
  role TEXT,
  email TEXT,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ,
  raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  banned_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth.identities (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_data JSONB DEFAULT '{}'::jsonb,
  provider TEXT,
  provider_id TEXT,
  email TEXT,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$ SELECT NULL::UUID $$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN DEFAULT false,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT
);
`

if (!existsSync(sqlFile)) {
  console.error('FAIL: Chybí supabase/apply-all-migrations.sql')
  process.exit(1)
}

const dataDir = mkdtempSync(join(tmpdir(), 'vh-bulldig-pg-'))
const port = 54000 + Math.floor(Math.random() * 1000)
const pgInstance = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})

console.log('Ověřuji apply-all-migrations.sql…')

try {
  await pgInstance.initialise()
  await pgInstance.start()
  await pgInstance.createDatabase('vh_bulldig_test')

  const client = new Client({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'vh_bulldig_test',
  })

  await client.connect()
  await client.query(supabaseBootstrap)
  await client.query(readFileSync(sqlFile, 'utf8'))
  await client.end()

  console.log('OK: Všech 19 migrací proběhlo bez chyby.')
} catch (error) {
  console.error('FAIL:', error.message)
  process.exit(1)
} finally {
  try {
    await pgInstance.stop()
  } catch {
    // ignore shutdown errors
  }
  rmSync(dataDir, { recursive: true, force: true })
}

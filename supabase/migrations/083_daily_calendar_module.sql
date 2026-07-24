-- ============================================================================
-- Migrace 083 – Modul Denní provozní kalendář (VH Bulldig ERP 8)
-- Spusťte po 082_fakturovac_storage_update.sql
--
-- Rozhodnutí potvrzená zadavatelem:
-- 1) Vazba den + zakázka = jeden záznam (UNIQUE entry_date + order_id).
--    Jeden den může obsahovat více zakázek (více řádků se stejným datem).
-- 2) První verze oprávnění: pouze administrátor (RLS níže odpovídá tomu).
-- 3) Automatické uzavření dne ve 23:59 (pg_cron) zde záměrně NENÍ obsaženo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enumerační typy
-- ----------------------------------------------------------------------------

CREATE TYPE calendar_day_status AS ENUM (
  'planovano',
  'probiha',
  'hotovo',
  'chybi_udaje'
);

CREATE TYPE calendar_task_priority AS ENUM (
  'nizka',
  'stredni',
  'vysoka'
);

CREATE TYPE calendar_task_status AS ENUM (
  'nezahajeno',
  'probiha',
  'hotovo'
);

-- ----------------------------------------------------------------------------
-- 2. Tabulka denních záznamů (den + zakázka = jeden řádek)
-- ----------------------------------------------------------------------------

CREATE TABLE daily_calendar_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date    DATE NOT NULL,
  order_id      UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  status        calendar_day_status NOT NULL DEFAULT 'planovano',
  worker_count  INTEGER CHECK (worker_count IS NULL OR worker_count >= 0),
  notes         TEXT NOT NULL DEFAULT '',
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_calendar_entries_date_order_unique UNIQUE (entry_date, order_id)
);

CREATE INDEX idx_daily_calendar_entries_date ON daily_calendar_entries(entry_date DESC);
CREATE INDEX idx_daily_calendar_entries_order ON daily_calendar_entries(order_id);

CREATE TRIGGER daily_calendar_entries_updated_at
  BEFORE UPDATE ON daily_calendar_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Tabulka úkolů dne (vázaná na konkrétní denní záznam)
-- ----------------------------------------------------------------------------

CREATE TABLE daily_calendar_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES daily_calendar_entries(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  priority    calendar_task_priority NOT NULL DEFAULT 'stredni',
  status      calendar_task_status NOT NULL DEFAULT 'nezahajeno',
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_calendar_tasks_entry ON daily_calendar_tasks(entry_id);

CREATE TRIGGER daily_calendar_tasks_updated_at
  BEFORE UPDATE ON daily_calendar_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Row Level Security – první verze: pouze administrátor
--    (stejný vzor jako u Fakturovače, migrace 081, funkce get_user_role()
--    již v databázi existuje, zde se pouze používá)
-- ----------------------------------------------------------------------------

ALTER TABLE daily_calendar_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_calendar_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte denní záznamy kalendáře"
  ON daily_calendar_entries FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin vkládá denní záznamy kalendáře"
  ON daily_calendar_entries FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje denní záznamy kalendáře"
  ON daily_calendar_entries FOR UPDATE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin maže denní záznamy kalendáře"
  ON daily_calendar_entries FOR DELETE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte úkoly dne"
  ON daily_calendar_tasks FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin vkládá úkoly dne"
  ON daily_calendar_tasks FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje úkoly dne"
  ON daily_calendar_tasks FOR UPDATE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin maže úkoly dne"
  ON daily_calendar_tasks FOR DELETE
  USING (get_user_role() = 'administrator');

-- ----------------------------------------------------------------------------
-- 5. Oprávnění pro roli authenticated (RLS výše stejně omezí na administrátora)
-- ----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON daily_calendar_entries TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_calendar_tasks TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Registrace modulu v erp_modules (stejný vzor jako u ostatních modulů)
-- ----------------------------------------------------------------------------

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES (
  'denni-kalendar',
  'Denní provozní kalendář',
  '/daily-calendar',
  'Calendar',
  19,
  true,
  '1.0.0'
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_implemented = true,
  module_version = EXCLUDED.module_version;

NOTIFY pgrst, 'reload schema';

-- Migrace 088 – Denní provozní kalendář: přestavba na automatický manažerský přehled
-- Spusťte po 087_invoiceable_header_immutable_when_closed.sql
--
-- DŮVOD ZMĚNY:
-- Migrace 083 vytvořila daily_calendar_entries jako RUČNÍ formulář (status,
-- worker_count, notes) + samostatnou tabulku úkolů. Nové zadání vyžaduje
-- kompletně automatický přehled bez jakéhokoliv ručního zásahu uživatele.
-- Proto se PŮVODNÍ tabulka daily_calendar_entries ROZŠIŘUJE (ne duplikuje)
-- o automaticky počítané sloupce a ruční sloupce se odstraňují. Tabulka
-- daily_calendar_tasks se ruší úplně – úkoly dne nejsou součástí zadání.
--
-- Vazba den + zakázka zůstává stejná: UNIQUE (entry_date, order_id) z migrace
-- 083 je zachována – jeden souhrn smí existovat pouze jednou pro tuto dvojici.

-- ----------------------------------------------------------------------------
-- 1. Zrušení ruční části (úkoly dne, ruční sloupce, nepoužité enum typy)
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS daily_calendar_tasks;
DROP TYPE IF EXISTS calendar_task_priority;
DROP TYPE IF EXISTS calendar_task_status;

ALTER TABLE daily_calendar_entries
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS worker_count,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS created_by;

DROP TYPE IF EXISTS calendar_day_status;

-- ----------------------------------------------------------------------------
-- 2. Rozšíření tabulky o automaticky počítané sloupce
-- ----------------------------------------------------------------------------

ALTER TABLE daily_calendar_entries
  ADD COLUMN IF NOT EXISTS diary_filled        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photos_count         INTEGER NOT NULL DEFAULT 0 CHECK (photos_count >= 0),
  ADD COLUMN IF NOT EXISTS costs_total          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wages_total          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_total          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_diary        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS missing_photos       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS missing_costs        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS missing_attendance   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS computed_at          TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 3. Automatický výpočet jednoho souhrnu (den + zakázka) – bezpečný UPSERT
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION compute_daily_calendar_summary(p_date DATE, p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_diary_filled      BOOLEAN;
  v_photos_count      INTEGER;
  v_costs_total       NUMERIC(12, 2);
  v_wages_total       NUMERIC(12, 2);
  v_has_approved_work BOOLEAN;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM construction_diary_entries
    WHERE entry_date = p_date AND order_id = p_order_id
  ) INTO v_diary_filled;

  SELECT COUNT(*) INTO v_photos_count
  FROM gps_photos
  WHERE captured_date = p_date AND order_id = p_order_id;

  SELECT COALESCE(SUM(price), 0) INTO v_costs_total
  FROM job_costs
  WHERE cost_date = p_date AND order_id = p_order_id;

  SELECT COALESCE(SUM(earnings), 0), EXISTS (
    SELECT 1 FROM worker_reports
    WHERE report_date = p_date AND order_id = p_order_id AND status = 'schvaleny'
  )
  INTO v_wages_total, v_has_approved_work
  FROM worker_reports
  WHERE report_date = p_date AND order_id = p_order_id AND status = 'schvaleny';

  INSERT INTO daily_calendar_entries (
    entry_date, order_id,
    diary_filled, photos_count, costs_total, wages_total, daily_total,
    missing_diary, missing_photos, missing_costs, missing_attendance,
    computed_at
  )
  VALUES (
    p_date, p_order_id,
    v_diary_filled, v_photos_count, v_costs_total, v_wages_total,
    v_costs_total + v_wages_total,
    NOT v_diary_filled, v_photos_count = 0, v_costs_total = 0, NOT v_has_approved_work,
    now()
  )
  ON CONFLICT (entry_date, order_id) DO UPDATE SET
    diary_filled        = EXCLUDED.diary_filled,
    photos_count         = EXCLUDED.photos_count,
    costs_total          = EXCLUDED.costs_total,
    wages_total          = EXCLUDED.wages_total,
    daily_total          = EXCLUDED.daily_total,
    missing_diary        = EXCLUDED.missing_diary,
    missing_photos       = EXCLUDED.missing_photos,
    missing_costs        = EXCLUDED.missing_costs,
    missing_attendance   = EXCLUDED.missing_attendance,
    computed_at          = EXCLUDED.computed_at,
    updated_at           = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. Hromadná uzávěrka jednoho dne – najde všechny zakázky s daty a přepočte je
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION run_daily_calendar_closure(p_date DATE)
RETURNS INTEGER AS $$
DECLARE
  v_order_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_order_id IN
    SELECT order_id FROM construction_diary_entries WHERE entry_date = p_date
    UNION
    SELECT order_id FROM gps_photos WHERE captured_date = p_date AND order_id IS NOT NULL
    UNION
    SELECT order_id FROM job_costs WHERE cost_date = p_date
    UNION
    SELECT order_id FROM worker_reports WHERE report_date = p_date AND order_id IS NOT NULL
  LOOP
    PERFORM compute_daily_calendar_summary(p_date, v_order_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 5. Reálný čas – přepočet ihned při zpětné opravě zdrojových dat
--    (zajišťuje, že oprava staršího dne nevytvoří nový záznam, jen přepočte
--    existující souhrn pro dané entry_date + order_id)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_recompute_from_diary()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM compute_daily_calendar_summary(OLD.entry_date, OLD.order_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM compute_daily_calendar_summary(NEW.entry_date, NEW.order_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_calendar_recompute_diary
  AFTER INSERT OR UPDATE OR DELETE ON construction_diary_entries
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_from_diary();

CREATE OR REPLACE FUNCTION trg_recompute_from_photos()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.order_id IS NOT NULL THEN
    PERFORM compute_daily_calendar_summary(OLD.captured_date, OLD.order_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.order_id IS NOT NULL THEN
    PERFORM compute_daily_calendar_summary(NEW.captured_date, NEW.order_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_calendar_recompute_photos
  AFTER INSERT OR UPDATE OR DELETE ON gps_photos
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_from_photos();

CREATE OR REPLACE FUNCTION trg_recompute_from_costs()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM compute_daily_calendar_summary(OLD.cost_date, OLD.order_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM compute_daily_calendar_summary(NEW.cost_date, NEW.order_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_calendar_recompute_costs
  AFTER INSERT OR UPDATE OR DELETE ON job_costs
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_from_costs();

CREATE OR REPLACE FUNCTION trg_recompute_from_reports()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.order_id IS NOT NULL THEN
    PERFORM compute_daily_calendar_summary(OLD.report_date, OLD.order_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.order_id IS NOT NULL THEN
    PERFORM compute_daily_calendar_summary(NEW.report_date, NEW.order_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_calendar_recompute_reports
  AFTER INSERT OR UPDATE OR DELETE ON worker_reports
  FOR EACH ROW EXECUTE FUNCTION trg_recompute_from_reports();

-- ----------------------------------------------------------------------------
-- 6. Automatická uzávěrka ve 23:59 Europe/Prague – nezávislá na prohlížeči
--    Plánovač pg_cron spouští kontrolu každou minutu (levná kontrola času),
--    skutečnou uzávěrku provede jen v minutě 23:59 pražského času – funguje
--    správně i při přechodu na letní/zimní čas, protože se čas přepočítává
--    přes AT TIME ZONE, ne přes pevný UTC offset.
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION daily_calendar_cron_tick()
RETURNS VOID AS $$
DECLARE
  v_prague_now TIMESTAMP;
BEGIN
  v_prague_now := now() AT TIME ZONE 'Europe/Prague';

  IF EXTRACT(HOUR FROM v_prague_now) = 23 AND EXTRACT(MINUTE FROM v_prague_now) = 59 THEN
    PERFORM run_daily_calendar_closure(v_prague_now::date);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'daily-calendar-closure-tick',
  '* * * * *',
  $$SELECT daily_calendar_cron_tick();$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-calendar-closure-tick'
);

-- ----------------------------------------------------------------------------
-- 7. RLS – jen čtení pro Administrátora a Majitele, žádný ruční zápis
--    Zápis provádí výhradně SECURITY DEFINER funkce výše (obchází RLS).
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin čte denní záznamy kalendáře" ON daily_calendar_entries;
DROP POLICY IF EXISTS "Admin vkládá denní záznamy kalendáře" ON daily_calendar_entries;
DROP POLICY IF EXISTS "Admin upravuje denní záznamy kalendáře" ON daily_calendar_entries;
DROP POLICY IF EXISTS "Admin maže denní záznamy kalendáře" ON daily_calendar_entries;

CREATE POLICY "Admin a majitel čtou automatický denní přehled"
  ON daily_calendar_entries FOR SELECT
  USING (get_user_role() IN ('administrator', 'majitel'));

REVOKE INSERT, UPDATE, DELETE ON daily_calendar_entries FROM authenticated;
GRANT SELECT ON daily_calendar_entries TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

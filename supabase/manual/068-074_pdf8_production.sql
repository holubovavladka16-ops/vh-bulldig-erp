-- PDF 8 migrace 068-074 pro produkční SQL Editor
-- Spusťte celý soubor najednou

-- ===== 068_pdf8_project_map_module.sql =====
-- PDF 8 – Zakázky, mapa, stavební deník, role Stavbyvedoucí (Fáze 1a)
-- project_id = job_orders.id (bez duplicitní tabulky projects)
--
-- Rollback (pouze v nouzi, ručně v SQL Editoru):
--   DROP TABLE IF EXISTS project_notifications CASCADE;
--   DROP TABLE IF EXISTS project_user_assignments CASCADE;
--   DROP TABLE IF EXISTS project_marker_status_history CASCADE;
--   DROP TABLE IF EXISTS project_status_overrides CASCADE;
--   DROP TABLE IF EXISTS project_map_markers CASCADE;
--   DROP FUNCTION IF EXISTS is_assigned_to_project(UUID);
--   DROP FUNCTION IF EXISTS is_stavbyvedouci();
--   DROP FUNCTION IF EXISTS is_administrator();
--   ALTER TABLE construction_diary_entries DROP COLUMN IF EXISTS entry_status;
--   ALTER TABLE company_settings DROP COLUMN IF EXISTS diary_check_time;
--   ALTER TABLE company_settings DROP COLUMN IF EXISTS working_days;
--   DELETE FROM erp_modules WHERE id = 'zakazky-mapa';
--   (enum hodnotu stavbyvedouci nelze bezpečně odebrat – ponechat)

-- ============================================================
-- 1. Nová role Stavbyvedoucí (enum user_role)
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'stavbyvedouci';

-- ============================================================
-- 2. Rozšíření company_settings (kontrolní čas + pracovní dny)
-- ============================================================

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS diary_check_time TIME NOT NULL DEFAULT '20:00:00',
  ADD COLUMN IF NOT EXISTS working_days INT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5];

COMMENT ON COLUMN company_settings.diary_check_time IS
  'Čas denní kontroly vyplnění stavebního deníku (PDF 8 §17).';

COMMENT ON COLUMN company_settings.working_days IS
  'Pracovní dny týdne – PostgreSQL DOW: 0=Ne, 1=Po, …, 6=So (PDF 8 §18).';

-- ============================================================
-- 3. Rozšíření stavebního deníku – workflow stav zápisu
-- ============================================================

ALTER TABLE construction_diary_entries
  ADD COLUMN IF NOT EXISTS entry_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE construction_diary_entries
  DROP CONSTRAINT IF EXISTS construction_diary_entries_entry_status_check;

ALTER TABLE construction_diary_entries
  ADD CONSTRAINT construction_diary_entries_entry_status_check
  CHECK (entry_status IN (
    'draft',
    'submitted',
    'pending_review',
    'approved',
    'returned',
    'rejected'
  ));

-- Existující záznamy ponechat ve stavu approved (současná funkčnost admin-only)
UPDATE construction_diary_entries
SET entry_status = 'approved'
WHERE entry_status IS NULL OR entry_status = '';

-- ============================================================
-- 4. Pomocné funkce pro RLS (bez závislosti na nových tabulkách)
-- ============================================================

CREATE OR REPLACE FUNCTION is_administrator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_role() = 'administrator';
$$;

CREATE OR REPLACE FUNCTION is_stavbyvedouci()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Porovnání přes text kvůli PG omezení: nová enum hodnota musí být commitnutá
  -- dříve, než ji lze použít v téže transakci (ALTER TYPE … ADD VALUE).
  SELECT get_user_role()::text = 'stavbyvedouci';
$$;

-- ============================================================
-- 5. Tabulky modulu Zakázky a mapa
-- ============================================================

CREATE TABLE project_map_markers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL UNIQUE REFERENCES job_orders(id) ON DELETE CASCADE,
  gps_lat        NUMERIC(10, 7) NOT NULL,
  gps_lng        NUMERIC(10, 7) NOT NULL,
  gps_accuracy   NUMERIC(10, 2),
  is_approximate BOOLEAN NOT NULL DEFAULT true,
  marker_color   TEXT NOT NULL DEFAULT 'green'
    CHECK (marker_color IN ('green', 'red', 'orange', 'blue')),
  color_source   TEXT NOT NULL DEFAULT 'auto'
    CHECK (color_source IN ('auto', 'manual')),
  color_label    TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_status_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  color       TEXT NOT NULL CHECK (color IN ('green', 'red', 'orange', 'blue')),
  reason      TEXT,
  note        TEXT,
  valid_from  DATE NOT NULL,
  valid_to    DATE,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_status_overrides_dates_check
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE project_marker_status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  old_color     TEXT CHECK (old_color IS NULL OR old_color IN ('green', 'red', 'orange', 'blue')),
  new_color     TEXT NOT NULL CHECK (new_color IN ('green', 'red', 'orange', 'blue')),
  color_label   TEXT NOT NULL DEFAULT '',
  change_type   TEXT NOT NULL CHECK (change_type IN ('auto', 'manual')),
  missing_date  DATE,
  reason        TEXT,
  valid_from    DATE,
  valid_to      DATE,
  changed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_user_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  valid_from   DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to     DATE,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  assigned_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_user_assignments_dates_check
    CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT project_user_assignments_unique_start
    UNIQUE (project_id, user_id, valid_from)
);

CREATE TABLE project_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  missing_date    DATE,
  message         TEXT NOT NULL,
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. Pomocná funkce závislá na project_user_assignments
-- ============================================================

CREATE OR REPLACE FUNCTION is_assigned_to_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_user_assignments a
    WHERE a.project_id = p_project_id
      AND a.user_id = auth.uid()
      AND a.is_active = true
      AND a.valid_from <= CURRENT_DATE
      AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
  );
$$;

-- ============================================================
-- 7. Indexy
-- ============================================================

CREATE INDEX idx_project_map_markers_color
  ON project_map_markers(marker_color);

CREATE INDEX idx_project_status_overrides_project
  ON project_status_overrides(project_id, valid_from DESC);

CREATE INDEX idx_project_marker_status_history_project
  ON project_marker_status_history(project_id, created_at DESC);

CREATE INDEX idx_project_user_assignments_project
  ON project_user_assignments(project_id)
  WHERE is_active = true;

CREATE INDEX idx_project_user_assignments_user
  ON project_user_assignments(user_id)
  WHERE is_active = true;

CREATE INDEX idx_project_notifications_project
  ON project_notifications(project_id, is_resolved, created_at DESC);

CREATE INDEX idx_project_notifications_target
  ON project_notifications(target_user_id, is_resolved)
  WHERE target_user_id IS NOT NULL;

CREATE INDEX idx_diary_entries_status
  ON construction_diary_entries(entry_status);

-- ============================================================
-- 8. Triggery
-- ============================================================

CREATE TRIGGER project_map_markers_updated_at
  BEFORE UPDATE ON project_map_markers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 9. RLS – nové tabulky
-- ============================================================

ALTER TABLE project_map_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_status_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_marker_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notifications ENABLE ROW LEVEL SECURITY;

-- project_map_markers
CREATE POLICY "Admin spravuje špendlíky zakázek"
  ON project_map_markers FOR ALL
  USING (is_administrator())
  WITH CHECK (is_administrator());

CREATE POLICY "Stavbyvedouci čte špendlíky přidělených zakázek"
  ON project_map_markers FOR SELECT
  USING (is_stavbyvedouci() AND is_assigned_to_project(project_id));

-- project_status_overrides (ruční stavy – pouze admin)
CREATE POLICY "Admin spravuje ruční stavy zakázek"
  ON project_status_overrides FOR ALL
  USING (is_administrator())
  WITH CHECK (is_administrator());

CREATE POLICY "Stavbyvedouci čte ruční stavy přidělených zakázek"
  ON project_status_overrides FOR SELECT
  USING (is_stavbyvedouci() AND is_assigned_to_project(project_id));

-- project_marker_status_history (audit – jen čtení pro stavbyvedoucí)
CREATE POLICY "Admin spravuje historii stavů špendlíků"
  ON project_marker_status_history FOR ALL
  USING (is_administrator())
  WITH CHECK (is_administrator());

CREATE POLICY "Stavbyvedouci čte historii stavů přidělených zakázek"
  ON project_marker_status_history FOR SELECT
  USING (is_stavbyvedouci() AND is_assigned_to_project(project_id));

-- project_user_assignments
CREATE POLICY "Admin spravuje přiřazení Stavbyvedoucích"
  ON project_user_assignments FOR ALL
  USING (is_administrator())
  WITH CHECK (is_administrator());

CREATE POLICY "Stavbyvedouci čte vlastní přiřazení"
  ON project_user_assignments FOR SELECT
  USING (is_stavbyvedouci() AND user_id = auth.uid());

-- project_notifications
CREATE POLICY "Admin spravuje upozornění zakázek"
  ON project_notifications FOR ALL
  USING (is_administrator())
  WITH CHECK (is_administrator());

CREATE POLICY "Stavbyvedouci čte upozornění přidělených zakázek"
  ON project_notifications FOR SELECT
  USING (
    is_stavbyvedouci()
    AND (
      target_user_id = auth.uid()
      OR is_assigned_to_project(project_id)
    )
  );

CREATE POLICY "Stavbyvedouci řeší vlastní upozornění"
  ON project_notifications FOR UPDATE
  USING (
    is_stavbyvedouci()
    AND target_user_id = auth.uid()
    AND is_assigned_to_project(project_id)
  )
  WITH CHECK (
    is_stavbyvedouci()
    AND target_user_id = auth.uid()
    AND is_assigned_to_project(project_id)
  );

-- ============================================================
-- 10. RLS – stavební deník (doplňkové politiky pro Stavbyvedoucího)
-- Stávající admin politiky z migrace 018 zůstávají beze změny.
-- ============================================================

CREATE POLICY "Stavbyvedouci čte deník přidělených zakázek"
  ON construction_diary_entries FOR SELECT
  USING (
    is_stavbyvedouci()
    AND is_assigned_to_project(order_id)
  );

CREATE POLICY "Stavbyvedouci vkládá deník přidělených zakázek"
  ON construction_diary_entries FOR INSERT
  WITH CHECK (
    is_stavbyvedouci()
    AND is_assigned_to_project(order_id)
    AND created_by = auth.uid()
    AND entry_status IN ('draft', 'submitted', 'pending_review')
  );

CREATE POLICY "Stavbyvedouci upravuje vlastní nefinální deník"
  ON construction_diary_entries FOR UPDATE
  USING (
    is_stavbyvedouci()
    AND is_assigned_to_project(order_id)
    AND created_by = auth.uid()
    AND entry_status IN ('draft', 'submitted', 'pending_review', 'returned')
  )
  WITH CHECK (
    is_stavbyvedouci()
    AND is_assigned_to_project(order_id)
    AND created_by = auth.uid()
    AND entry_status IN ('draft', 'submitted', 'pending_review', 'returned')
  );

-- ============================================================
-- 11. RLS – docházka (doplňkové politiky pro Stavbyvedoucího)
-- ============================================================

CREATE POLICY "Stavbyvedouci čte docházku přidělených zakázek"
  ON worker_attendance_records FOR SELECT
  USING (
    is_stavbyvedouci()
    AND order_id IS NOT NULL
    AND is_assigned_to_project(order_id)
  );

CREATE POLICY "Stavbyvedouci vkládá docházku přidělených zakázek"
  ON worker_attendance_records FOR INSERT
  WITH CHECK (
    is_stavbyvedouci()
    AND order_id IS NOT NULL
    AND is_assigned_to_project(order_id)
  );

-- ============================================================
-- 12. RLS – náklady (doplňkové politiky pro Stavbyvedoucího)
-- ============================================================

CREATE POLICY "Stavbyvedouci čte náklady přidělených zakázek"
  ON job_costs FOR SELECT
  USING (
    is_stavbyvedouci()
    AND is_assigned_to_project(order_id)
  );

CREATE POLICY "Stavbyvedouci vkládá náklady přidělených zakázek"
  ON job_costs FOR INSERT
  WITH CHECK (
    is_stavbyvedouci()
    AND is_assigned_to_project(order_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Stavbyvedouci upravuje vlastní nefinální náklady"
  ON job_costs FOR UPDATE
  USING (
    is_stavbyvedouci()
    AND is_assigned_to_project(order_id)
    AND created_by = auth.uid()
  )
  WITH CHECK (
    is_stavbyvedouci()
    AND is_assigned_to_project(order_id)
    AND created_by = auth.uid()
  );

-- ============================================================
-- 13. Oprávnění (GRANT)
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON project_map_markers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_status_overrides TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_marker_status_history TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_user_assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_notifications TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION is_administrator() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_stavbyvedouci() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_assigned_to_project(UUID) TO authenticated, service_role;

-- ============================================================
-- 14. Registrace modulu v erp_modules
-- ============================================================

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES (
  'zakazky-mapa',
  'Zakázky a mapa',
  '/zakazky-mapa',
  'MapPin',
  5,
  false,
  '0.0.0'
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  module_version = EXCLUDED.module_version;

NOTIFY pgrst, 'reload schema';


-- ===== 069_pdf8_marker_optional_gps.sql =====
-- PDF 8 Fáze 1b – hlavní špendlík může existovat bez GPS (dopočet později)

ALTER TABLE project_map_markers
  ALTER COLUMN gps_lat DROP NOT NULL,
  ALTER COLUMN gps_lng DROP NOT NULL;

COMMENT ON COLUMN project_map_markers.gps_lat IS
  'Zeměpisná šířka hlavního špendlíku; NULL = neúplný, čeká na geokódování.';

COMMENT ON COLUMN project_map_markers.gps_lng IS
  'Zeměpisná délka hlavního špendlíku; NULL = neúplný, čeká na geokódování.';

NOTIFY pgrst, 'reload schema';


-- ===== 070_pdf8_manual_marker_color_majitel.sql =====
-- PDF 8 Fáze 1f – role Majitel + oprávnění ruční změny barvy špendlíku
--
-- Rollback (nouze, ručně):
--   DROP POLICY IF EXISTS "Admin nebo Majitel spravuje špendlíky zakázek" ON project_map_markers;
--   DROP POLICY IF EXISTS "Admin nebo Majitel spravuje ruční stavy zakázek" ON project_status_overrides;
--   DROP POLICY IF EXISTS "Admin nebo Majitel spravuje historii stavů špendlíků" ON project_marker_status_history;
--   (enum hodnoty majitel/ucetni ponechat)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'majitel';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ucetni';

CREATE OR REPLACE FUNCTION is_majitel()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_role()::text = 'majitel';
$$;

CREATE OR REPLACE FUNCTION can_manage_marker_color()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_administrator() OR is_majitel();
$$;

DROP POLICY IF EXISTS "Admin spravuje špendlíky zakázek" ON project_map_markers;
CREATE POLICY "Admin nebo Majitel spravuje špendlíky zakázek"
  ON project_map_markers FOR ALL
  USING (can_manage_marker_color())
  WITH CHECK (can_manage_marker_color());

DROP POLICY IF EXISTS "Admin spravuje ruční stavy zakázek" ON project_status_overrides;
CREATE POLICY "Admin nebo Majitel spravuje ruční stavy zakázek"
  ON project_status_overrides FOR ALL
  USING (can_manage_marker_color())
  WITH CHECK (can_manage_marker_color());

DROP POLICY IF EXISTS "Admin spravuje historii stavů špendlíků" ON project_marker_status_history;
CREATE POLICY "Admin nebo Majitel spravuje historii stavů špendlíků"
  ON project_marker_status_history FOR ALL
  USING (can_manage_marker_color())
  WITH CHECK (can_manage_marker_color());

GRANT EXECUTE ON FUNCTION is_majitel() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_manage_marker_color() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ===== 071_pdf8_stavbyvedouci_assignments_rls.sql =====
-- PDF 8 Fáze 1g – přiřazení Stavbyvedoucích, RLS, audit, jeden hlavní SV

-- ============================================================
-- 1. Pomocné funkce
-- ============================================================

CREATE OR REPLACE FUNCTION can_manage_project_assignments()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_administrator() OR is_majitel();
$$;

CREATE OR REPLACE FUNCTION has_full_project_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_administrator() OR is_majitel();
$$;

CREATE OR REPLACE FUNCTION check_active_project_assignment(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_assigned_to_project(p_project_id);
$$;

-- ============================================================
-- 2. Audit přiřazení
-- ============================================================

CREATE TABLE IF NOT EXISTS project_user_assignment_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID REFERENCES project_user_assignments(id) ON DELETE SET NULL,
  project_id      UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'deactivated', 'removed', 'set_primary', 'reactivated'
  )),
  is_primary      BOOLEAN,
  valid_from      DATE,
  valid_to        DATE,
  is_active       BOOLEAN,
  changed_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_user_assignment_history_project
  ON project_user_assignment_history(project_id, created_at DESC);

ALTER TABLE project_user_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin nebo Majitel čte audit přiřazení"
  ON project_user_assignment_history FOR SELECT
  USING (can_manage_project_assignments());

CREATE POLICY "Admin nebo Majitel zapisuje audit přiřazení"
  ON project_user_assignment_history FOR INSERT
  WITH CHECK (can_manage_project_assignments());

GRANT SELECT, INSERT ON project_user_assignment_history TO authenticated, service_role;

-- ============================================================
-- 3. Jeden aktivní hlavní Stavbyvedoucí na zakázku
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_single_primary_stavbyvedouci()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary = true AND NEW.is_active = true THEN
    UPDATE project_user_assignments
    SET is_primary = false
    WHERE project_id = NEW.project_id
      AND id IS DISTINCT FROM NEW.id
      AND is_primary = true
      AND is_active = true
      AND valid_from <= CURRENT_DATE
      AND (valid_to IS NULL OR valid_to >= CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_primary_stavbyvedouci ON project_user_assignments;
CREATE TRIGGER trg_enforce_single_primary_stavbyvedouci
  BEFORE INSERT OR UPDATE OF is_primary, is_active, valid_from, valid_to
  ON project_user_assignments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_primary_stavbyvedouci();

-- ============================================================
-- 4. project_user_assignments – Majitel spravuje, SV jen čte vlastní
-- ============================================================

DROP POLICY IF EXISTS "Admin spravuje přiřazení Stavbyvedoucích" ON project_user_assignments;
CREATE POLICY "Admin nebo Majitel spravuje přiřazení Stavbyvedoucích"
  ON project_user_assignments FOR ALL
  USING (can_manage_project_assignments())
  WITH CHECK (can_manage_project_assignments());

-- Stavbyvedouci policy z 068 zůstává: čte pouze vlastní přiřazení

-- ============================================================
-- 5. job_orders – plný přístup Admin/Majitel, SV jen přidělené
-- ============================================================

CREATE POLICY "Majitel spravuje zakázky"
  ON job_orders FOR ALL
  USING (is_majitel())
  WITH CHECK (is_majitel());

CREATE POLICY "Stavbyvedouci čte přidělené zakázky"
  ON job_orders FOR SELECT
  USING (is_stavbyvedouci() AND is_assigned_to_project(id));

-- ============================================================
-- 6. Dokumenty a fotky zakázky
-- ============================================================

CREATE POLICY "Majitel čte dokumenty zakázek"
  ON job_order_documents FOR SELECT
  USING (is_majitel());

CREATE POLICY "Stavbyvedouci čte dokumenty přidělených zakázek"
  ON job_order_documents FOR SELECT
  USING (is_stavbyvedouci() AND is_assigned_to_project(order_id));

CREATE POLICY "Majitel čte fotky zakázek"
  ON job_order_photos FOR SELECT
  USING (is_majitel());

CREATE POLICY "Stavbyvedouci čte fotky přidělených zakázek"
  ON job_order_photos FOR SELECT
  USING (is_stavbyvedouci() AND is_assigned_to_project(order_id));

-- ============================================================
-- 7. worker_reports, worker_daily_forms – výkazy přidělených zakázek
-- ============================================================

CREATE POLICY "Stavbyvedouci čte výkazy přidělených zakázek"
  ON worker_reports FOR SELECT
  USING (
    is_stavbyvedouci()
    AND order_id IS NOT NULL
    AND is_assigned_to_project(order_id)
  );

CREATE POLICY "Stavbyvedouci čte denní formuláře přidělených zakázek"
  ON worker_daily_forms FOR SELECT
  USING (
    is_stavbyvedouci()
    AND order_id IS NOT NULL
    AND is_assigned_to_project(order_id)
  );

-- ============================================================
-- 8. gps_photos – deník / přípojky u přidělených zakázek
-- ============================================================

CREATE POLICY "Stavbyvedouci čte GPS fotky přidělených zakázek"
  ON gps_photos FOR SELECT
  USING (
    is_stavbyvedouci()
    AND order_id IS NOT NULL
    AND is_assigned_to_project(order_id)
  );

CREATE POLICY "Stavbyvedouci vkládá GPS fotky přidělených zakázek"
  ON gps_photos FOR INSERT
  WITH CHECK (
    is_stavbyvedouci()
    AND order_id IS NOT NULL
    AND is_assigned_to_project(order_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Stavbyvedouci upravuje GPS fotky přidělených zakázek"
  ON gps_photos FOR UPDATE
  USING (
    is_stavbyvedouci()
    AND order_id IS NOT NULL
    AND is_assigned_to_project(order_id)
    AND created_by = auth.uid()
  )
  WITH CHECK (
    is_stavbyvedouci()
    AND order_id IS NOT NULL
    AND is_assigned_to_project(order_id)
    AND created_by = auth.uid()
  );

-- ============================================================
-- 9. get_job_order_detail – kontrola přiřazení pro Stavbyvedoucího
-- ============================================================

CREATE OR REPLACE FUNCTION get_job_order_detail(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF has_full_project_access() THEN
    NULL;
  ELSIF is_stavbyvedouci() THEN
    IF NOT is_assigned_to_project(p_order_id) THEN
      RAISE EXCEPTION 'Nedostatečná oprávnění';
    END IF;
  ELSE
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT jsonb_build_object(
    'order', to_jsonb(jo.*),
    'documents', COALESCE((
      SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at DESC)
      FROM job_order_documents d WHERE d.order_id = jo.id
    ), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at DESC)
      FROM job_order_photos p WHERE p.order_id = jo.id
    ), '[]'::jsonb),
    'employees', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object(
        'id', w.id,
        'first_name', w.first_name,
        'last_name', w.last_name,
        'position', w."position"
      ))
      FROM workers w
      WHERE w.assigned_order_id = jo.id
         OR w.id IN (SELECT DISTINCT f.worker_id FROM worker_daily_forms f WHERE f.order_id = jo.id)
    ), '[]'::jsonb),
    'attendance', COALESCE((
      SELECT jsonb_agg(to_jsonb(a.*) ORDER BY a.attendance_date DESC)
      FROM worker_attendance_records a WHERE a.order_id = jo.id
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(to_jsonb(r.*) ORDER BY r.report_date DESC)
      FROM worker_reports r WHERE r.order_id = jo.id
    ), '[]'::jsonb),
    'advances', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'form_date', f.form_date,
        'worker_id', f.worker_id,
        'worker_name', w.first_name || ' ' || w.last_name,
        'advance', f.advance,
        'earnings', f.earnings
      ) ORDER BY f.form_date DESC)
      FROM worker_daily_forms f
      JOIN workers w ON w.id = f.worker_id
      WHERE f.order_id = jo.id AND f.advance > 0
        AND f.status IN ('odeslany', 'schvaleny')
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM job_orders jo
  WHERE jo.id = p_order_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Zakázka nenalezena';
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 10. Seznam profilů Stavbyvedoucích pro správu přiřazení
-- ============================================================

CREATE POLICY "Majitel čte profily pro správu přiřazení"
  ON profiles FOR SELECT
  USING (is_majitel());

CREATE OR REPLACE FUNCTION list_stavbyvedouci_profiles()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.full_name, p.is_active
  FROM profiles p
  WHERE p.role::text = 'stavbyvedouci'
    AND can_manage_project_assignments()
  ORDER BY p.full_name, p.email;
$$;

GRANT EXECUTE ON FUNCTION can_manage_project_assignments() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION has_full_project_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_active_project_assignment(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION list_stavbyvedouci_profiles() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ===== 072_pdf8_stavbyvedouci_workers_rpc.sql =====
-- PDF 8 Fáze 1h – RPC pro pracovníky na přidělené zakázce (Stavbyvedoucí)

CREATE OR REPLACE FUNCTION list_workers_for_assigned_order(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.id,
    w.first_name,
    w.last_name,
    trim(w.last_name || ' ' || w.first_name) AS full_name
  FROM workers w
  WHERE w.status = 'aktivni'
    AND w.assigned_order_id = p_order_id
    AND (
      has_full_project_access()
      OR (is_stavbyvedouci() AND is_assigned_to_project(p_order_id))
    )
  ORDER BY w.last_name, w.first_name;
$$;

GRANT EXECUTE ON FUNCTION list_workers_for_assigned_order(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ===== 073_pdf8_diary_missing_notifications.sql =====
-- PDF 8 Fáze 1i – Upozornění na chybějící stavební deník

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Prague';

COMMENT ON COLUMN company_settings.timezone IS
  'Firemní časové pásmo pro kontrolu deníku (PDF 8 Fáze 1i).';

ALTER TABLE project_notifications
  DROP CONSTRAINT IF EXISTS project_notifications_type_check;

ALTER TABLE project_notifications
  ADD CONSTRAINT project_notifications_type_check
  CHECK (type IN ('missing_diary'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_notifications_dedup
  ON project_notifications(project_id, type, missing_date, target_user_id);

-- ============================================================
-- RLS – Majitel vidí upozornění
-- ============================================================

CREATE POLICY "Majitel spravuje upozornění zakázek"
  ON project_notifications FOR ALL
  USING (is_majitel())
  WITH CHECK (is_majitel());

-- Odstranění redundantní SELECT politiky – ALL ji pokrývá
DROP POLICY IF EXISTS "Majitel čte upozornění zakázek" ON project_notifications;

-- ============================================================
-- Pomocné funkce
-- ============================================================

CREATE OR REPLACE FUNCTION diary_entry_is_valid(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status IN ('approved', 'submitted', 'pending_review');
$$;

CREATE OR REPLACE FUNCTION is_manual_diary_check_paused(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_map_markers m
    WHERE m.project_id = p_project_id
      AND m.color_source = 'manual'
      AND m.marker_color IN ('red', 'orange', 'blue')
  );
$$;

CREATE OR REPLACE FUNCTION get_primary_stavbyvedouci_user_id(p_project_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.user_id
  FROM project_user_assignments a
  JOIN profiles p ON p.id = a.user_id
  WHERE a.project_id = p_project_id
    AND a.is_active = true
    AND a.is_primary = true
    AND a.valid_from <= CURRENT_DATE
    AND (a.valid_to IS NULL OR a.valid_to >= CURRENT_DATE)
    AND p.role = 'stavbyvedouci'
    AND p.is_active = true
  ORDER BY a.valid_from DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_diary_check_local_context(p_at TIMESTAMPTZ DEFAULT now())
RETURNS TABLE (
  local_date DATE,
  local_minutes INT,
  local_dow INT,
  diary_check_time TIME,
  working_days INT[],
  timezone TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz TEXT;
  v_check TIME;
  v_days INT[];
BEGIN
  SELECT
    COALESCE(cs.timezone, 'Europe/Prague'),
    COALESCE(cs.diary_check_time, TIME '20:00:00'),
    COALESCE(cs.working_days, ARRAY[1, 2, 3, 4, 5])
  INTO v_tz, v_check, v_days
  FROM company_settings cs
  LIMIT 1;

  RETURN QUERY
  SELECT
    (timezone(v_tz, p_at))::date AS local_date,
    (
      EXTRACT(HOUR FROM timezone(v_tz, p_at))::int * 60
      + EXTRACT(MINUTE FROM timezone(v_tz, p_at))::int
    ) AS local_minutes,
    EXTRACT(DOW FROM timezone(v_tz, p_at))::int AS local_dow,
    v_check,
    v_days,
    v_tz;
END;
$$;

CREATE OR REPLACE FUNCTION project_has_valid_diary_on_date(
  p_project_id UUID,
  p_entry_date DATE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM construction_diary_entries e
    WHERE e.order_id = p_project_id
      AND e.entry_date = p_entry_date
      AND diary_entry_is_valid(e.entry_status)
  );
$$;

CREATE OR REPLACE FUNCTION resolve_missing_diary_notifications(
  p_project_id UUID,
  p_missing_date DATE,
  p_resolved_by UUID DEFAULT auth.uid()
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT project_has_valid_diary_on_date(p_project_id, p_missing_date) THEN
    RETURN 0;
  END IF;

  UPDATE project_notifications
  SET
    is_resolved = true,
    resolved_at = now(),
    resolved_by = p_resolved_by
  WHERE project_id = p_project_id
    AND type = 'missing_diary'
    AND missing_date = p_missing_date
    AND NOT is_resolved;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION run_missing_diary_check(p_at TIMESTAMPTZ DEFAULT now())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx RECORD;
  v_order RECORD;
  v_marker RECORD;
  v_recipient UUID;
  v_missing_date DATE;
  v_message TEXT;
  v_check_minutes INT;
  v_created INT := 0;
  v_updated INT := 0;
  v_checked INT := 0;
  v_resolved INT := 0;
BEGIN
  IF NOT (is_administrator() OR is_majitel() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_ctx FROM get_diary_check_local_context(p_at) LIMIT 1;
  v_check_minutes :=
    EXTRACT(HOUR FROM v_ctx.diary_check_time)::int * 60
    + EXTRACT(MINUTE FROM v_ctx.diary_check_time)::int;

  IF NOT (v_ctx.local_dow = ANY (v_ctx.working_days)) THEN
    RETURN jsonb_build_object(
      'checked_projects', 0,
      'notifications_created', 0,
      'notifications_resolved', 0,
      'markers_updated', 0,
      'skipped_reason', 'non_working_day'
    );
  END IF;

  IF v_ctx.local_minutes < v_check_minutes THEN
    RETURN jsonb_build_object(
      'checked_projects', 0,
      'notifications_created', 0,
      'notifications_resolved', 0,
      'markers_updated', 0,
      'skipped_reason', 'before_check_time'
    );
  END IF;

  v_missing_date := v_ctx.local_date;

  FOR v_order IN
    SELECT jo.*
    FROM job_orders jo
    WHERE jo.status = 'aktivni'
      AND jo.start_date <= v_missing_date
      AND jo.end_date >= v_missing_date
  LOOP
    v_checked := v_checked + 1;

    IF is_manual_diary_check_paused(v_order.id) THEN
      CONTINUE;
    END IF;

    IF project_has_valid_diary_on_date(v_order.id, v_missing_date) THEN
      v_resolved := v_resolved + resolve_missing_diary_notifications(v_order.id, v_missing_date, NULL);
      CONTINUE;
    END IF;

    v_message := format(
      'U zakázky „%s“ (%s) chybí stavební deník za %s.',
      v_order.name,
      COALESCE(NULLIF(trim(v_order.location), ''), '—'),
      to_char(v_missing_date, 'YYYY-MM-DD')
    );

    FOR v_recipient IN
      SELECT DISTINCT p.id
      FROM profiles p
      WHERE p.is_active = true
        AND p.role IN ('administrator', 'majitel')
      UNION
      SELECT get_primary_stavbyvedouci_user_id(v_order.id)
    LOOP
      IF v_recipient IS NULL THEN
        CONTINUE;
      END IF;

      BEGIN
        INSERT INTO project_notifications (
          project_id,
          type,
          missing_date,
          message,
          target_user_id
        )
        VALUES (
          v_order.id,
          'missing_diary',
          v_missing_date,
          v_message,
          v_recipient
        );
        v_created := v_created + 1;
      EXCEPTION
        WHEN unique_violation THEN
          NULL;
      END;
    END LOOP;

    SELECT * INTO v_marker
    FROM project_map_markers
    WHERE project_id = v_order.id;

    IF v_marker IS NOT NULL AND v_marker.color_source = 'auto' THEN
      IF v_marker.marker_color IS DISTINCT FROM 'red'
         OR v_marker.color_label IS DISTINCT FROM 'Chybí stavební deník' THEN
        INSERT INTO project_marker_status_history (
          project_id,
          old_color,
          new_color,
          color_label,
          change_type,
          missing_date,
          reason
        )
        VALUES (
          v_order.id,
          v_marker.marker_color,
          'red',
          'Chybí stavební deník',
          'auto',
          v_missing_date,
          'Automatická kontrola chybějícího deníku'
        );

        UPDATE project_map_markers
        SET
          marker_color = 'red',
          color_label = 'Chybí stavební deník',
          color_source = 'auto'
        WHERE project_id = v_order.id
          AND color_source = 'auto';

        v_updated := v_updated + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'checked_projects', v_checked,
    'notifications_created', v_created,
    'notifications_resolved', v_resolved,
    'markers_updated', v_updated
  );
END;
$$;

CREATE OR REPLACE FUNCTION trg_resolve_missing_diary_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF diary_entry_is_valid(NEW.entry_status) THEN
    PERFORM resolve_missing_diary_notifications(NEW.order_id, NEW.entry_date, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_missing_diary_notifications_insert ON construction_diary_entries;
CREATE TRIGGER resolve_missing_diary_notifications_insert
  AFTER INSERT OR UPDATE OF entry_status, entry_date, order_id
  ON construction_diary_entries
  FOR EACH ROW
  EXECUTE FUNCTION trg_resolve_missing_diary_notifications();

GRANT EXECUTE ON FUNCTION diary_entry_is_valid(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_manual_diary_check_paused(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_primary_stavbyvedouci_user_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_diary_check_local_context(TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION project_has_valid_diary_on_date(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION resolve_missing_diary_notifications(UUID, DATE, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION run_missing_diary_check(TIMESTAMPTZ) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ===== 074_pdf8_phase_1j_finalize.sql =====
-- PDF 8 Fáze 1j – Finální opravy modulu Zakázky a mapa

-- ============================================================
-- 1. Majitel – čtení firemního nastavení (kontrola deníku)
-- ============================================================

CREATE POLICY "Majitel čte firemní nastavení"
  ON company_settings FOR SELECT
  USING (is_majitel());

-- ============================================================
-- 2. Majitel – stavební deník (stejný rozsah jako administrátor)
-- ============================================================

CREATE POLICY "Majitel čte stavební deník"
  ON construction_diary_entries FOR SELECT
  USING (is_majitel());

CREATE POLICY "Majitel vkládá stavební deník"
  ON construction_diary_entries FOR INSERT
  WITH CHECK (is_majitel());

CREATE POLICY "Majitel upravuje stavební deník"
  ON construction_diary_entries FOR UPDATE
  USING (is_majitel())
  WITH CHECK (is_majitel());

CREATE POLICY "Majitel maže stavební deník"
  ON construction_diary_entries FOR DELETE
  USING (is_majitel());

-- ============================================================
-- 3. SECURITY DEFINER přepočet barvy špendlíku (všechny role)
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_project_marker_color(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marker project_map_markers%ROWTYPE;
  v_order job_orders%ROWTYPE;
  v_ctx RECORD;
  v_check_minutes INT;
  v_entry_dates DATE[];
  v_has_today BOOLEAN;
  v_new_color TEXT;
  v_new_label TEXT;
  v_old_color TEXT;
  v_old_label TEXT;
BEGIN
  SELECT * INTO v_marker FROM project_map_markers WHERE project_id = p_project_id;
  IF NOT FOUND OR v_marker.color_source = 'manual' THEN
    RETURN;
  END IF;

  SELECT * INTO v_order FROM job_orders WHERE id = p_project_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT e.entry_date ORDER BY e.entry_date)
  INTO v_entry_dates
  FROM construction_diary_entries e
  WHERE e.order_id = p_project_id
    AND diary_entry_is_valid(e.entry_status);

  v_entry_dates := COALESCE(v_entry_dates, ARRAY[]::DATE[]);

  SELECT * INTO v_ctx FROM get_diary_check_local_context(now()) LIMIT 1;
  v_check_minutes :=
    EXTRACT(HOUR FROM v_ctx.diary_check_time)::int * 60
    + EXTRACT(MINUTE FROM v_ctx.diary_check_time)::int;

  v_has_today := v_ctx.local_date = ANY (v_entry_dates);

  v_new_color := 'green';
  v_new_label := 'Probíhá v pořádku';

  IF v_ctx.local_date < v_order.start_date THEN
    v_new_color := 'blue';
    v_new_label := 'Čeká na zahájení';
  ELSIF v_ctx.local_date > v_order.end_date THEN
    v_new_color := 'red';
    v_new_label := 'Vyžaduje zásah';
  ELSIF v_order.status <> 'aktivni' THEN
    v_new_color := 'blue';
    v_new_label := 'Čeká na zahájení';
  ELSIF v_ctx.local_dow = ANY (v_ctx.working_days)
        AND NOT v_has_today
        AND v_ctx.local_minutes >= v_check_minutes
        AND v_ctx.local_date >= v_order.start_date
        AND v_ctx.local_date <= v_order.end_date THEN
    v_new_color := 'red';
    v_new_label := 'Chybí stavební deník';
  ELSIF v_has_today THEN
    v_new_color := 'green';
    v_new_label := 'Probíhá v pořádku';
  END IF;

  v_old_color := v_marker.marker_color;
  v_old_label := v_marker.color_label;

  IF v_new_color IS DISTINCT FROM v_old_color OR v_new_label IS DISTINCT FROM v_old_label THEN
    UPDATE project_map_markers
    SET
      marker_color = v_new_color,
      color_label = v_new_label,
      color_source = 'auto'
    WHERE project_id = p_project_id
      AND color_source = 'auto';

    INSERT INTO project_marker_status_history (
      project_id,
      old_color,
      new_color,
      color_label,
      change_type,
      reason
    )
    VALUES (
      p_project_id,
      v_old_color,
      v_new_color,
      v_new_label,
      'auto',
      'Automatický přepočet barvy špendlíku'
    );
  END IF;
END;
$$;

-- ============================================================
-- 4. Trigger – přepočet barvy po platném zápisu deníku
-- ============================================================

CREATE OR REPLACE FUNCTION trg_resolve_missing_diary_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF diary_entry_is_valid(NEW.entry_status) THEN
    PERFORM resolve_missing_diary_notifications(NEW.order_id, NEW.entry_date, NEW.created_by);
    PERFORM recalculate_project_marker_color(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION recalculate_project_marker_color(UUID) TO authenticated, service_role;

-- ============================================================
-- 5. Modul zakazky-mapa – označit jako implementovaný
-- ============================================================

UPDATE erp_modules
SET
  is_implemented = true,
  module_version = '1.0.0'
WHERE id = 'zakazky-mapa';

NOTIFY pgrst, 'reload schema';



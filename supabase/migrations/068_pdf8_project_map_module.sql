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

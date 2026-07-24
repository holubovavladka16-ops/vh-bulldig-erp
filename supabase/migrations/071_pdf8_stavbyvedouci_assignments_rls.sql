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

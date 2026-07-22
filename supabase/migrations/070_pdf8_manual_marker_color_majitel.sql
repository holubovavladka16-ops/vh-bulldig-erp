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

-- Zabezpečení ERP – neveřejný systém, přístup pouze administrátor
-- Portál zaměstnance zůstává dostupný přes jedinečný token (RPC funkce)

CREATE OR REPLACE FUNCTION resolve_portal_worker_id(p_token UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID;
BEGIN
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Neplatný odkaz';
  END IF;

  SELECT w.id INTO v_worker_id
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Odkaz není platný nebo byl deaktivován';
  END IF;

  RETURN v_worker_id;
END;
$$;

REVOKE ALL ON FUNCTION resolve_portal_worker_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_portal_worker_id(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_regenerate_portal_token(p_worker_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token UUID := gen_random_uuid();
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Přístup pouze pro administrátora';
  END IF;

  UPDATE workers
  SET portal_token = v_new_token, updated_at = now()
  WHERE id = p_worker_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zaměstnanec nenalezen';
  END IF;

  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_regenerate_portal_token(UUID) TO authenticated;

-- ============================================================
-- RLS – ERP tabulky pouze pro administrátora
-- ============================================================

DROP POLICY IF EXISTS "Admin a vedoucí čtou zaměstnance" ON workers;
CREATE POLICY "Admin čte zaměstnance"
  ON workers FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou ceník" ON worker_price_items;
CREATE POLICY "Admin čte ceník"
  ON worker_price_items FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou dokumenty" ON worker_documents;
CREATE POLICY "Admin čte dokumenty zaměstnanců"
  ON worker_documents FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou formuláře" ON worker_daily_forms;
CREATE POLICY "Admin čte formuláře"
  ON worker_daily_forms FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou fotografie" ON worker_form_photos;
CREATE POLICY "Admin čte fotografie formulářů"
  ON worker_form_photos FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou výkazy" ON worker_reports;
CREATE POLICY "Admin čte výkazy"
  ON worker_reports FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou docházku" ON worker_attendance_records;
CREATE POLICY "Admin čte docházku"
  ON worker_attendance_records FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou historii" ON worker_history;
CREATE POLICY "Admin čte historii"
  ON worker_history FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou statistiky" ON worker_statistics;
CREATE POLICY "Admin čte statistiky"
  ON worker_statistics FOR SELECT
  USING (get_user_role() = 'administrator');

-- Modul zakázky
DROP POLICY IF EXISTS "Admin a vedoucí čtou zakázky" ON job_orders;
CREATE POLICY "Admin čte zakázky"
  ON job_orders FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou dokumenty zakázek" ON job_order_documents;
CREATE POLICY "Admin čte dokumenty zakázek"
  ON job_order_documents FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou fotky zakázek" ON job_order_photos;
CREATE POLICY "Admin čte fotky zakázek"
  ON job_order_photos FOR SELECT
  USING (get_user_role() = 'administrator');

-- Modul náklady
DROP POLICY IF EXISTS "Admin čte náklady" ON job_costs;
-- policy may already be admin only

-- Modul fotodokumentace
DROP POLICY IF EXISTS "ERP uživatelé čtou fotodokumentaci" ON gps_photos;
DROP POLICY IF EXISTS "ERP uživatelé vytváří fotodokumentaci" ON gps_photos;
DROP POLICY IF EXISTS "ERP uživatelé upravují fotodokumentaci" ON gps_photos;
DROP POLICY IF EXISTS "Admin maže fotodokumentaci" ON gps_photos;
DROP POLICY IF EXISTS "Admin a vedoucí čtou fotky" ON gps_photos;
DROP POLICY IF EXISTS "Admin a vedoucí vkládají fotky" ON gps_photos;
DROP POLICY IF EXISTS "Admin a vedoucí upravují fotky" ON gps_photos;
DROP POLICY IF EXISTS "ERP uživatelé čtou historii fotek" ON gps_photo_history;
DROP POLICY IF EXISTS "ERP uživatelé zapisují historii fotek" ON gps_photo_history;
DROP POLICY IF EXISTS "Admin a vedoucí čtou historii fotek" ON gps_photo_history;
DROP POLICY IF EXISTS "Admin a vedoucí zapisují historii fotek" ON gps_photo_history;

CREATE POLICY "Admin čte fotky"
  ON gps_photos FOR SELECT
  USING (get_user_role() = 'administrator');
CREATE POLICY "Admin vkládá fotky"
  ON gps_photos FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');
CREATE POLICY "Admin upravuje fotky"
  ON gps_photos FOR UPDATE
  USING (get_user_role() = 'administrator');
CREATE POLICY "Admin maže fotky"
  ON gps_photos FOR DELETE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte historii fotek"
  ON gps_photo_history FOR SELECT
  USING (get_user_role() = 'administrator');
CREATE POLICY "Admin zapisuje historii fotek"
  ON gps_photo_history FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

-- Stavební deník
DROP POLICY IF EXISTS "ERP uživatelé čtou stavební deník" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin vytváří zápisy deníku" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin upravuje zápisy deníku" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin maže zápisy deníku" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin a vedoucí čtou deník" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin a vedoucí vkládají deník" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin a vedoucí upravují deník" ON construction_diary_entries;

CREATE POLICY "Admin čte deník"
  ON construction_diary_entries FOR SELECT
  USING (get_user_role() = 'administrator');
CREATE POLICY "Admin vkládá deník"
  ON construction_diary_entries FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');
CREATE POLICY "Admin upravuje deník"
  ON construction_diary_entries FOR UPDATE
  USING (get_user_role() = 'administrator');
CREATE POLICY "Admin maže deník"
  ON construction_diary_entries FOR DELETE
  USING (get_user_role() = 'administrator');

-- Přípojky
DROP POLICY IF EXISTS "Admin a vedoucí čtou přípojky" ON utility_connections;
CREATE POLICY "Admin čte přípojky"
  ON utility_connections FOR SELECT
  USING (get_user_role() = 'administrator');

-- Nastavení – pouze admin (kromě vlastního app_settings profilu)
DROP POLICY IF EXISTS "Přihlášení vidí nastavení aplikace" ON app_settings;
CREATE POLICY "Admin a vlastník vidí nastavení aplikace"
  ON app_settings FOR SELECT
  USING (user_id = auth.uid() OR get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Přihlášení upravují své nastavení" ON app_settings;
CREATE POLICY "Admin a vlastník upravují nastavení aplikace"
  ON app_settings FOR UPDATE
  USING (user_id = auth.uid() OR get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Přihlášení vidí nastavení společnosti" ON company_settings;
CREATE POLICY "Admin vidí nastavení společnosti"
  ON company_settings FOR SELECT
  USING (get_user_role() = 'administrator');

-- Portálové RPC – striktní validace tokenu
CREATE OR REPLACE FUNCTION portal_get_worker(p_token UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  "position" TEXT,
  status worker_status,
  employment_type employment_type,
  assigned_order TEXT,
  assigned_order_id UUID
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
    w."position",
    w.status,
    w.employment_type,
    COALESCE(jo.name, w.assigned_order, ''),
    w.assigned_order_id
  FROM workers w
  LEFT JOIN job_orders jo ON jo.id = w.assigned_order_id
  WHERE w.id = resolve_portal_worker_id(p_token);
$$;

CREATE OR REPLACE FUNCTION portal_get_reports(p_token UUID)
RETURNS SETOF worker_reports
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM worker_reports r
  WHERE r.worker_id = resolve_portal_worker_id(p_token)
  ORDER BY r.report_date DESC;
$$;

CREATE OR REPLACE FUNCTION portal_get_earnings_summary(p_token UUID)
RETURNS TABLE (
  today_earnings NUMERIC,
  month_earnings NUMERIC,
  month_hours NUMERIC,
  month_meters NUMERIC,
  month_orders INTEGER,
  month_advances NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID := resolve_portal_worker_id(p_token);
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(earnings) FROM worker_daily_forms WHERE worker_id = v_worker_id AND form_date = CURRENT_DATE AND status IN ('odeslany', 'schvaleny')), 0),
    COALESCE((SELECT SUM(earnings) FROM worker_reports WHERE worker_id = v_worker_id AND report_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(hours) FROM worker_attendance_records WHERE worker_id = v_worker_id AND attendance_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(meters) FROM worker_statistics WHERE worker_id = v_worker_id AND stat_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(orders_count)::INTEGER FROM worker_statistics WHERE worker_id = v_worker_id AND stat_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(advances) FROM worker_statistics WHERE worker_id = v_worker_id AND stat_date >= date_trunc('month', CURRENT_DATE)::date), 0);
END;
$$;

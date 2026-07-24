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

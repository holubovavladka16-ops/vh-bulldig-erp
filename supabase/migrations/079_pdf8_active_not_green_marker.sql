-- PDF 8 – stav zakázky (aktivní) nesmí automaticky znamenat zelený marker
--
-- Pravidlo: marker_color = green pouze po kontrole schváleného deníku.
-- job_orders.status = 'aktivni' nikdy samo o sobě nebarví marker na zelenou.

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
  v_approved_dates DATE[];
  v_any_diary_count INT;
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

  -- Bezpečný výchozí stav – nikdy zelená
  v_new_color := 'red';
  v_new_label := 'Chybí stavební deník';

  SELECT COUNT(*)::INT
  INTO v_any_diary_count
  FROM construction_diary_entries e
  WHERE e.order_id = p_project_id;

  IF v_any_diary_count = 0 THEN
    NULL; -- ponechat červenou
  ELSE
    SELECT array_agg(DISTINCT e.entry_date ORDER BY e.entry_date)
    INTO v_approved_dates
    FROM construction_diary_entries e
    WHERE e.order_id = p_project_id
      AND diary_entry_is_approved_for_marker(e.entry_status);

    v_approved_dates := COALESCE(v_approved_dates, ARRAY[]::DATE[]);

    SELECT * INTO v_ctx FROM get_diary_check_local_context(now()) LIMIT 1;
    v_check_minutes :=
      EXTRACT(HOUR FROM v_ctx.diary_check_time)::int * 60
      + EXTRACT(MINUTE FROM v_ctx.diary_check_time)::int;

    v_has_today := v_ctx.local_date = ANY (v_approved_dates);

    IF v_ctx.local_date < v_order.start_date THEN
      v_new_color := 'blue';
      v_new_label := 'Čeká na zahájení';
    ELSIF v_ctx.local_date > v_order.end_date THEN
      v_new_color := 'red';
      v_new_label := 'Vyžaduje zásah';
    ELSIF v_order.status IN ('pozastavena', 'dokoncena', 'archivovana', 'pripravuje_se') THEN
      v_new_color := 'blue';
      v_new_label := 'Čeká na zahájení';
    ELSIF cardinality(v_approved_dates) = 0 THEN
      v_new_color := 'red';
      v_new_label := 'Chybí stavební deník';
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
    ELSE
      -- Deník existuje, ale dnešní schválený zápis chybí – ponechat červenou/oranžovou logiku v aplikaci
      v_new_color := 'red';
      v_new_label := 'Chybí stavební deník';
    END IF;
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

-- Backfill: aktivní zakázky bez deníku nesmí mít zelený marker
UPDATE project_map_markers m
SET
  marker_color = 'red',
  color_label = 'Chybí stavební deník',
  updated_at = now()
WHERE m.color_source = 'auto'
  AND m.marker_color = 'green'
  AND NOT EXISTS (
    SELECT 1 FROM construction_diary_entries e WHERE e.order_id = m.project_id
  );

-- Přepočet zakázek se zeleným markerem bez schváleného deníku pro dnešek
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT m.project_id
    FROM project_map_markers m
    WHERE m.color_source = 'auto'
      AND m.marker_color = 'green'
      AND EXISTS (
        SELECT 1 FROM construction_diary_entries e WHERE e.order_id = m.project_id
      )
  LOOP
    PERFORM recalculate_project_marker_color(r.project_id);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION recalculate_project_marker_color(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

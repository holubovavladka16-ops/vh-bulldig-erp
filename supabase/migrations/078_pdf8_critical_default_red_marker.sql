-- PDF 8 KRITICKÁ OPRAVA – výchozí červená barva nového špendlíku
--
-- Rollback: obnovit funkce z migrace 077

-- ============================================================
-- 1. Výchozí hodnota sloupce marker_color
-- ============================================================

ALTER TABLE project_map_markers
  ALTER COLUMN marker_color SET DEFAULT 'red';

-- ============================================================
-- 2. Trigger po vytvoření zakázky – červený marker + přepočet
-- ============================================================

CREATE OR REPLACE FUNCTION ensure_project_map_marker_on_order_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_approximate BOOLEAN;
BEGIN
  v_is_approximate :=
    NEW.gps_lat IS NULL
    OR NEW.gps_lng IS NULL
    OR NEW.gps_accuracy IS NULL
    OR NEW.gps_accuracy > 15;

  INSERT INTO project_map_markers (
    project_id,
    gps_lat,
    gps_lng,
    gps_accuracy,
    is_approximate,
    marker_color,
    color_source,
    color_label
  )
  VALUES (
    NEW.id,
    NEW.gps_lat,
    NEW.gps_lng,
    NEW.gps_accuracy,
    v_is_approximate,
    'red',
    'auto',
    'Chybí stavební deník'
  )
  ON CONFLICT (project_id) DO NOTHING;

  PERFORM recalculate_project_marker_color(NEW.id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_project_map_marker_on_order_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_approximate BOOLEAN;
BEGIN
  IF NEW.gps_lat IS NOT DISTINCT FROM OLD.gps_lat
     AND NEW.gps_lng IS NOT DISTINCT FROM OLD.gps_lng
     AND NEW.gps_accuracy IS NOT DISTINCT FROM OLD.gps_accuracy THEN
    RETURN NEW;
  END IF;

  v_is_approximate :=
    NEW.gps_lat IS NULL
    OR NEW.gps_lng IS NULL
    OR NEW.gps_accuracy IS NULL
    OR NEW.gps_accuracy > 15;

  UPDATE project_map_markers
  SET
    gps_lat = NEW.gps_lat,
    gps_lng = NEW.gps_lng,
    gps_accuracy = NEW.gps_accuracy,
    is_approximate = v_is_approximate,
    updated_at = now()
  WHERE project_id = NEW.id
    AND (
      gps_lat IS NULL
      OR gps_lng IS NULL
      OR gps_lat IS DISTINCT FROM NEW.gps_lat
      OR gps_lng IS DISTINCT FROM NEW.gps_lng
    );

  IF NOT FOUND THEN
    INSERT INTO project_map_markers (
      project_id,
      gps_lat,
      gps_lng,
      gps_accuracy,
      is_approximate,
      marker_color,
      color_source,
      color_label
    )
    VALUES (
      NEW.id,
      NEW.gps_lat,
      NEW.gps_lng,
      NEW.gps_accuracy,
      v_is_approximate,
      'red',
      'auto',
      'Chybí stavební deník'
    )
    ON CONFLICT (project_id) DO NOTHING;
  END IF;

  PERFORM recalculate_project_marker_color(NEW.id);

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Přepočet – bez jakéhokoli zápisu deníku vždy červená
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

  SELECT COUNT(*)::INT
  INTO v_any_diary_count
  FROM construction_diary_entries e
  WHERE e.order_id = p_project_id;

  IF v_any_diary_count = 0 THEN
    v_new_color := 'red';
    v_new_label := 'Chybí stavební deník';
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
    ELSIF cardinality(v_approved_dates) = 0
          AND v_ctx.local_date >= v_order.start_date
          AND v_ctx.local_date <= v_order.end_date THEN
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

-- ============================================================
-- 4. Backfill – aktivní zakázky bez deníku → červená
-- ============================================================

UPDATE project_map_markers m
SET
  marker_color = 'red',
  color_label = 'Chybí stavební deník',
  updated_at = now()
WHERE m.color_source = 'auto'
  AND NOT EXISTS (
    SELECT 1 FROM construction_diary_entries e WHERE e.order_id = m.project_id
  )
  AND EXISTS (
    SELECT 1 FROM job_orders o
    WHERE o.id = m.project_id
      AND o.status = 'aktivni'
      AND CURRENT_DATE >= o.start_date
      AND CURRENT_DATE <= o.end_date
  );

-- ============================================================
-- 5. Backfill – zakázky s deníkem přepočítat (ruční barvy ponechat)
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT m.project_id
    FROM project_map_markers m
    WHERE m.color_source = 'auto'
      AND EXISTS (
        SELECT 1 FROM construction_diary_entries e WHERE e.order_id = m.project_id
      )
  LOOP
    PERFORM recalculate_project_marker_color(r.project_id);
  END LOOP;
END;
$$;

-- ============================================================
-- 6. Chybějící markery pro aktivní zakázky
-- ============================================================

INSERT INTO project_map_markers (
  project_id,
  gps_lat,
  gps_lng,
  gps_accuracy,
  is_approximate,
  marker_color,
  color_source,
  color_label
)
SELECT
  o.id,
  o.gps_lat,
  o.gps_lng,
  o.gps_accuracy,
  (
    o.gps_lat IS NULL
    OR o.gps_lng IS NULL
    OR o.gps_accuracy IS NULL
    OR o.gps_accuracy > 15
  ),
  'red',
  'auto',
  'Chybí stavební deník'
FROM job_orders o
WHERE o.status = 'aktivni'
  AND NOT EXISTS (
    SELECT 1 FROM project_map_markers m WHERE m.project_id = o.id
  )
ON CONFLICT (project_id) DO NOTHING;

GRANT EXECUTE ON FUNCTION recalculate_project_marker_color(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

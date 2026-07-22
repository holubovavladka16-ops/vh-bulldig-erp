-- PDF 8 – barva špendlíku jen ze schváleného deníku (approved)
--
-- Rollback:
--   Obnovit diary_entry_is_valid a recalculate z migrace 076

-- ============================================================
-- 1. Schválený deník pro barvu špendlíku
-- ============================================================

CREATE OR REPLACE FUNCTION diary_entry_is_approved_for_marker(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION diary_entry_is_approved_for_marker(TEXT) TO authenticated, service_role;

-- ============================================================
-- 2. Přepočet barvy – pouze schválené zápisy (approved)
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
    AND diary_entry_is_approved_for_marker(e.entry_status);

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
  ELSIF cardinality(v_entry_dates) = 0
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
-- 3. Trigger – přepočet i po smazání / změně stavu
-- ============================================================

CREATE OR REPLACE FUNCTION trg_diary_entry_marker_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
    IF diary_entry_is_valid(NEW.entry_status) THEN
      PERFORM resolve_missing_diary_notifications(NEW.order_id, NEW.entry_date, NEW.created_by);
    END IF;
  END IF;

  PERFORM recalculate_project_marker_color(v_order_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_missing_diary_notifications_insert ON construction_diary_entries;
DROP TRIGGER IF EXISTS trg_diary_entry_marker_recalc ON construction_diary_entries;

CREATE TRIGGER trg_diary_entry_marker_recalc
  AFTER INSERT OR UPDATE OF entry_status, entry_date, order_id OR DELETE
  ON construction_diary_entries
  FOR EACH ROW
  EXECUTE FUNCTION trg_diary_entry_marker_recalc();

-- ============================================================
-- 4. Backfill – markery bez schváleného deníku → červená
-- ============================================================

UPDATE project_map_markers m
SET
  marker_color = 'red',
  color_label = 'Chybí stavební deník',
  updated_at = now()
WHERE m.color_source = 'auto'
  AND NOT EXISTS (
    SELECT 1
    FROM construction_diary_entries e
    WHERE e.order_id = m.project_id
      AND diary_entry_is_approved_for_marker(e.entry_status)
  )
  AND EXISTS (
    SELECT 1
    FROM job_orders o
    WHERE o.id = m.project_id
      AND o.status = 'aktivni'
      AND CURRENT_DATE >= o.start_date
      AND CURRENT_DATE <= o.end_date
  )
  AND (m.marker_color <> 'red' OR m.color_label <> 'Chybí stavební deník');

GRANT EXECUTE ON FUNCTION recalculate_project_marker_color(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trg_diary_entry_marker_recalc() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

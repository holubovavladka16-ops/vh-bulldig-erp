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

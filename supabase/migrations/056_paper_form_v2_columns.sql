-- Papírové měsíční výkazy v2: sloupce výkop/průraz, tisk z karty, jeden aktivní formulář/měsíc

ALTER TABLE paper_monthly_form_lines
  ADD COLUMN IF NOT EXISTS manual_dig_bm NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS penetration_ks NUMERIC(8, 2);

ALTER TABLE paper_monthly_forms
  ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ;

ALTER TABLE paper_monthly_forms
  DROP CONSTRAINT IF EXISTS paper_monthly_forms_worker_id_month_year_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_paper_forms_one_active_per_worker_month
  ON paper_monthly_forms (worker_id, month, year)
  WHERE worker_id IS NOT NULL
    AND status NOT IN ('archived', 'rejected');

CREATE OR REPLACE FUNCTION get_worker_price_item_by_name(p_worker_id UUID, p_name_prefix TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM worker_price_items
  WHERE worker_id = p_worker_id
    AND is_active = true
    AND name ILIKE p_name_prefix || '%'
  ORDER BY is_default DESC, sort_order ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_worker_active_paper_form(
  p_worker_id UUID,
  p_month SMALLINT,
  p_year SMALLINT
)
RETURNS TABLE (
  id UUID,
  form_number TEXT,
  public_id TEXT,
  status paper_form_status,
  printed_at TIMESTAMPTZ,
  month SMALLINT,
  year SMALLINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.form_number, f.public_id, f.status, f.printed_at, f.month, f.year
  FROM paper_monthly_forms f
  WHERE f.worker_id = p_worker_id
    AND f.month = p_month
    AND f.year = p_year
    AND f.status NOT IN ('archived', 'rejected')
  ORDER BY f.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION cancel_paper_monthly_form(
  p_form_id UUID,
  p_reason TEXT DEFAULT 'Zrušeno administrátorem'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  UPDATE paper_monthly_forms SET
    status = 'rejected',
    rejection_reason = COALESCE(p_reason, 'Zrušeno administrátorem'),
    updated_at = now()
  WHERE id = p_form_id
    AND status NOT IN ('archived', 'rejected');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulář nelze zrušit (nenalezen nebo již archivován/zrušen)';
  END IF;

  INSERT INTO paper_monthly_import_log (paper_form_id, action, payload, performed_by)
  VALUES (p_form_id, 'cancel', jsonb_build_object('reason', p_reason), auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION create_paper_monthly_form_for_worker(
  p_worker_id UUID,
  p_month SMALLINT,
  p_year SMALLINT,
  p_supervisor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_existing UUID;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT f.id INTO v_existing
  FROM paper_monthly_forms f
  WHERE f.worker_id = p_worker_id
    AND f.month = p_month
    AND f.year = p_year
    AND f.status NOT IN ('archived', 'rejected')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_FORM:%', v_existing;
  END IF;

  v_id := create_paper_monthly_form(p_month, p_year, p_supervisor_id);
  PERFORM assign_paper_monthly_form_worker(v_id, p_worker_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION mark_paper_form_printed(
  p_form_id UUID,
  p_blank_pdf_path TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  UPDATE paper_monthly_forms SET
    status = CASE
      WHEN status IN ('draft', 'assigned') THEN 'printed'::paper_form_status
      ELSE status
    END,
    blank_pdf_path = COALESCE(p_blank_pdf_path, blank_pdf_path),
    printed_at = COALESCE(printed_at, now()),
    updated_at = now()
  WHERE id = p_form_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulář nenalezen';
  END IF;

  INSERT INTO paper_monthly_import_log (paper_form_id, action, payload, performed_by)
  VALUES (p_form_id, 'print', jsonb_build_object('path', p_blank_pdf_path), auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION apply_paper_form_ai_import(
  p_form_id UUID,
  p_lines JSONB,
  p_summary JSONB DEFAULT '{}'::jsonb,
  p_ai_raw JSONB DEFAULT '{}'::jsonb,
  p_ai_confidence NUMERIC DEFAULT NULL,
  p_ai_model TEXT DEFAULT NULL,
  p_scanned_photo_path TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line JSONB;
  v_line_no INTEGER;
  v_max_line INTEGER;
  v_order_id UUID;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT COALESCE(MAX(line_number), 31) INTO v_max_line
  FROM paper_monthly_form_lines
  WHERE paper_form_id = p_form_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    IF COALESCE(v_line->>'line_role', 'attendance_primary') = 'attendance_primary' THEN
      v_order_id := resolve_order_by_short_code(v_line->>'order_code');
      IF v_order_id IS NULL AND v_line->>'order_id' IS NOT NULL THEN
        v_order_id := (v_line->>'order_id')::UUID;
      END IF;

      UPDATE paper_monthly_form_lines SET
        work_start = NULLIF(v_line->>'work_start', '')::TIME,
        work_end = NULLIF(v_line->>'work_end', '')::TIME,
        performance_hours = COALESCE(
          NULLIF(v_line->>'performance_hours', '')::NUMERIC,
          NULLIF(v_line->>'total_hours', '')::NUMERIC
        ),
        manual_dig_bm = NULLIF(v_line->>'manual_dig_bm', '')::NUMERIC,
        penetration_ks = NULLIF(v_line->>'penetration_ks', '')::NUMERIC,
        daily_advance = COALESCE((v_line->>'daily_advance')::NUMERIC, 0),
        order_code = NULLIF(v_line->>'order_code', ''),
        order_id = v_order_id,
        order_name_resolved = v_line->>'order_name_resolved',
        attendance_status = COALESCE((v_line->>'attendance_status')::attendance_status, 'pritomen'),
        ai_confidence = (v_line->>'ai_confidence')::NUMERIC,
        ai_flags = COALESCE(v_line->'ai_flags', '{}'::jsonb)
      WHERE paper_form_id = p_form_id
        AND form_date = (v_line->>'form_date')::DATE
        AND line_role = 'attendance_primary';
    ELSE
      v_line_no := v_max_line + 1;
      v_max_line := v_line_no;
      v_order_id := resolve_order_by_short_code(v_line->>'order_code');
      INSERT INTO paper_monthly_form_lines (
        paper_form_id, line_number, source_section, form_date, line_role,
        order_code, order_id, order_name_resolved, work_type_text, quantity, unit,
        performance_hours, daily_advance, material, note, ai_confidence, ai_flags, sort_order
      )
      VALUES (
        p_form_id,
        v_line_no,
        COALESCE(v_line->>'source_section', 'performance_breakdown'),
        (v_line->>'form_date')::DATE,
        COALESCE((v_line->>'line_role')::paper_form_line_role, 'performance'),
        NULLIF(v_line->>'order_code', ''),
        v_order_id,
        v_line->>'order_name_resolved',
        v_line->>'work_type_text',
        NULLIF(v_line->>'quantity', '')::NUMERIC,
        NULLIF(v_line->>'unit', ''),
        NULLIF(v_line->>'performance_hours', '')::NUMERIC,
        COALESCE((v_line->>'daily_advance')::NUMERIC, 0),
        COALESCE(v_line->>'material', ''),
        COALESCE(v_line->>'note', ''),
        (v_line->>'ai_confidence')::NUMERIC,
        COALESCE(v_line->'ai_flags', '{}'::jsonb),
        v_line_no
      );
    END IF;
  END LOOP;

  UPDATE paper_monthly_forms SET
    status = 'review',
    summary = COALESCE(p_summary, '{}'::jsonb),
    ai_raw_response = COALESCE(p_ai_raw, '{}'::jsonb),
    ai_confidence = p_ai_confidence,
    ai_model = p_ai_model,
    ai_processed_at = now(),
    scanned_photo_path = COALESCE(p_scanned_photo_path, scanned_photo_path),
    imported_by = auth.uid(),
    imported_at = now(),
    updated_at = now()
  WHERE id = p_form_id;

  INSERT INTO paper_monthly_import_log (paper_form_id, action, payload, performed_by)
  VALUES (
    p_form_id, 'ai_extract',
    jsonb_build_object('line_count', jsonb_array_length(COALESCE(p_lines, '[]'::jsonb)), 'confidence', p_ai_confidence),
    auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION commit_paper_monthly_form(
  p_form_id UUID,
  p_performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form paper_monthly_forms%ROWTYPE;
  v_day paper_monthly_form_lines%ROWTYPE;
  v_grp RECORD;
  v_att RECORD;
  v_task_items JSONB;
  v_form_id UUID;
  v_attendance_id UUID;
  v_is_first BOOLEAN;
  v_created INTEGER := 0;
  v_performer UUID;
  v_default_order UUID;
  v_hourly_item UUID;
  v_dig_item UUID;
  v_pen_item UUID;
  v_hours NUMERIC(8, 2);
  v_note TEXT;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_form FROM paper_monthly_forms WHERE id = p_form_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulář nenalezen';
  END IF;
  IF v_form.worker_id IS NULL THEN
    RAISE EXCEPTION 'Formulář nemá přiřazeného zaměstnance';
  END IF;
  IF v_form.status NOT IN ('review', 'imported', 'printed', 'scanned', 'returned', 'distributed') THEN
    RAISE EXCEPTION 'Formulář nelze schválit ve stavu %', v_form.status;
  END IF;

  v_performer := COALESCE(p_performed_by, auth.uid());
  v_hourly_item := get_worker_hourly_price_item(v_form.worker_id);
  v_dig_item := get_worker_price_item_by_name(v_form.worker_id, 'Ruční výkop hloubka 50');
  v_pen_item := get_worker_price_item_by_name(v_form.worker_id, 'Průraz do objektu');

  FOR v_day IN
    SELECT * FROM paper_monthly_form_lines
    WHERE paper_form_id = p_form_id
      AND line_role = 'attendance_primary'
      AND order_id IS NOT NULL
      AND (
        work_start IS NOT NULL
        OR work_end IS NOT NULL
        OR COALESCE(performance_hours, 0) > 0
        OR COALESCE(manual_dig_bm, 0) > 0
        OR COALESCE(penetration_ks, 0) > 0
        OR COALESCE(daily_advance, 0) > 0
      )
    ORDER BY form_date
  LOOP
    v_hours := COALESCE(
      NULLIF(v_day.performance_hours, 0),
      calc_work_hours(v_day.work_start, v_day.work_end, COALESCE(v_day.break_minutes, 0))
    );

    v_task_items := '[]'::jsonb;
    IF v_hourly_item IS NOT NULL AND v_hours > 0 THEN
      v_task_items := jsonb_build_array(jsonb_build_object('price_item_id', v_hourly_item, 'quantity', v_hours));
    END IF;

    IF v_dig_item IS NOT NULL AND COALESCE(v_day.manual_dig_bm, 0) > 0 THEN
      v_task_items := v_task_items || jsonb_build_array(
        jsonb_build_object('price_item_id', v_dig_item, 'quantity', v_day.manual_dig_bm)
      );
    END IF;

    IF v_pen_item IS NOT NULL AND COALESCE(v_day.penetration_ks, 0) > 0 THEN
      v_task_items := v_task_items || jsonb_build_array(
        jsonb_build_object('price_item_id', v_pen_item, 'quantity', v_day.penetration_ks)
      );
    END IF;

    v_note := v_day.note;

    v_attendance_id := admin_upsert_attendance(
      v_form.worker_id,
      v_day.form_date,
      v_day.order_id,
      COALESCE(v_day.daily_advance, 0),
      COALESCE(v_note, ''),
      v_task_items,
      v_day.work_start,
      v_day.work_end,
      COALESCE(v_day.break_minutes, 0),
      NULL,
      v_performer,
      COALESCE(v_day.attendance_status, 'pritomen')
    );

    SELECT form_id INTO v_form_id FROM worker_attendance_records WHERE id = v_attendance_id;
    UPDATE paper_monthly_form_lines SET worker_daily_form_id = v_form_id WHERE id = v_day.id;
    v_created := v_created + 1;
  END LOOP;

  FOR v_grp IN
    SELECT l.form_date, l.order_id, MIN(l.sort_order) AS first_sort
    FROM paper_monthly_form_lines l
    WHERE l.paper_form_id = p_form_id
      AND l.line_role IN ('performance', 'performance_continuation')
      AND l.order_id IS NOT NULL
      AND (COALESCE(l.quantity, 0) > 0 OR COALESCE(l.performance_hours, 0) > 0 OR l.price_item_id IS NOT NULL)
    GROUP BY l.form_date, l.order_id
    ORDER BY l.form_date, MIN(l.sort_order)
  LOOP
    IF EXISTS (
      SELECT 1 FROM paper_monthly_form_lines
      WHERE paper_form_id = p_form_id AND form_date = v_grp.form_date
        AND line_role = 'attendance_primary' AND order_id = v_grp.order_id
        AND worker_daily_form_id IS NOT NULL
    ) THEN
      CONTINUE;
    END IF;

    SELECT work_start, work_end, break_minutes, attendance_status, daily_advance, note
    INTO v_att
    FROM paper_monthly_form_lines
    WHERE paper_form_id = p_form_id AND form_date = v_grp.form_date AND line_role = 'attendance_primary'
    LIMIT 1;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'price_item_id', l.price_item_id,
      'quantity', COALESCE(NULLIF(l.quantity, 0), l.performance_hours, 0)
    )) FILTER (WHERE l.price_item_id IS NOT NULL AND COALESCE(NULLIF(l.quantity, 0), l.performance_hours, 0) > 0), '[]'::jsonb)
    INTO v_task_items
    FROM paper_monthly_form_lines l
    WHERE l.paper_form_id = p_form_id AND l.form_date = v_grp.form_date AND l.order_id = v_grp.order_id
      AND l.line_role IN ('performance', 'performance_continuation');

    IF jsonb_array_length(v_task_items) = 0 THEN CONTINUE; END IF;

    SELECT NOT EXISTS (
      SELECT 1 FROM paper_monthly_form_lines
      WHERE paper_form_id = p_form_id AND form_date = v_grp.form_date
        AND line_role IN ('performance', 'performance_continuation')
        AND order_id IS NOT NULL AND sort_order < v_grp.first_sort
    ) INTO v_is_first;

    v_attendance_id := admin_upsert_attendance(
      v_form.worker_id, v_grp.form_date, v_grp.order_id,
      CASE WHEN v_is_first THEN COALESCE(v_att.daily_advance, 0) ELSE 0 END,
      COALESCE(v_att.note, ''), v_task_items,
      CASE WHEN v_is_first THEN v_att.work_start ELSE NULL END,
      CASE WHEN v_is_first THEN v_att.work_end ELSE NULL END,
      CASE WHEN v_is_first THEN COALESCE(v_att.break_minutes, 0) ELSE 0 END,
      NULL, v_performer, COALESCE(v_att.attendance_status, 'pritomen')
    );

    SELECT form_id INTO v_form_id FROM worker_attendance_records WHERE id = v_attendance_id;
    UPDATE paper_monthly_form_lines SET worker_daily_form_id = v_form_id
    WHERE paper_form_id = p_form_id AND form_date = v_grp.form_date AND order_id = v_grp.order_id
      AND line_role IN ('performance', 'performance_continuation');
    v_created := v_created + 1;
  END LOOP;

  FOR v_att IN
    SELECT form_date, work_start, work_end, break_minutes, attendance_status
    FROM paper_monthly_form_lines
    WHERE paper_form_id = p_form_id AND line_role = 'attendance_primary'
      AND attendance_status IS DISTINCT FROM 'pritomen'
      AND order_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM paper_monthly_form_lines p
        WHERE p.paper_form_id = p_form_id AND p.form_date = paper_monthly_form_lines.form_date
          AND p.worker_daily_form_id IS NOT NULL
      )
  LOOP
    SELECT id INTO v_default_order FROM job_orders WHERE status = 'aktivni' ORDER BY start_date DESC LIMIT 1;
    IF v_default_order IS NULL THEN
      RAISE EXCEPTION 'Pro dny bez zakázky je potřeba alespoň jedna aktivní zakázka';
    END IF;
    v_attendance_id := admin_upsert_attendance(
      v_form.worker_id, v_att.form_date, v_default_order, 0, '', '[]'::jsonb,
      v_att.work_start, v_att.work_end, COALESCE(v_att.break_minutes, 0),
      NULL, v_performer, v_att.attendance_status
    );
    v_created := v_created + 1;
  END LOOP;

  UPDATE paper_monthly_forms SET
    status = 'archived',
    approved_by = v_performer,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_form_id;

  INSERT INTO paper_monthly_import_log (paper_form_id, action, payload, performed_by)
  VALUES (p_form_id, 'commit', jsonb_build_object('created_forms', v_created), v_performer);

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (
    v_form.worker_id, 'Papírová měsíční docházka importována',
    jsonb_build_object('paper_form_id', p_form_id, 'form_number', v_form.form_number, 'created_forms', v_created),
    v_performer
  );

  RETURN jsonb_build_object('created_forms', v_created, 'paper_form_id', p_form_id);
END;
$$;

UPDATE erp_modules SET
  label = 'Papírové měsíční výkazy',
  module_version = '1.2.0'
WHERE id = 'papierove-vykazy';

GRANT EXECUTE ON FUNCTION get_worker_price_item_by_name(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_worker_active_paper_form(UUID, SMALLINT, SMALLINT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_paper_monthly_form(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_paper_monthly_form_for_worker(UUID, SMALLINT, SMALLINT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

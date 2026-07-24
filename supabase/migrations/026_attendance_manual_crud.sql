-- Ruční docházka: stav, poznámka, admin CRUD

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM (
    'pritomen',
    'dovolena',
    'nemoc',
    'ocr',
    'neplacene_volno'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE worker_attendance_records
  ADD COLUMN IF NOT EXISTS attendance_status attendance_status NOT NULL DEFAULT 'pritomen',
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION admin_upsert_attendance(
  p_worker_id UUID,
  p_attendance_date DATE,
  p_order_id UUID,
  p_work_start TIME,
  p_work_end TIME,
  p_break_minutes INTEGER,
  p_attendance_status attendance_status,
  p_note TEXT,
  p_id UUID DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_name TEXT := '';
  v_hours NUMERIC(8, 2);
  v_record_id UUID;
  v_existing_form_id UUID;
  v_activity TEXT;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění pro správu docházky';
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT name INTO v_order_name FROM job_orders WHERE id = p_order_id;
    IF v_order_name IS NULL THEN
      RAISE EXCEPTION 'Zakázka neexistuje';
    END IF;
  END IF;

  IF p_attendance_status = 'pritomen' THEN
    v_hours := COALESCE(calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0)), 0);
  ELSE
    v_hours := 0;
  END IF;

  v_activity := CASE p_attendance_status
    WHEN 'pritomen' THEN 'Docházka – přítomen'
    WHEN 'dovolena' THEN 'Dovolená'
    WHEN 'nemoc' THEN 'Nemocenská'
    WHEN 'ocr' THEN 'OČR'
    ELSE 'Neplacené volno'
  END;

  IF p_id IS NOT NULL THEN
    SELECT form_id INTO v_existing_form_id
    FROM worker_attendance_records
    WHERE id = p_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Záznam docházky neexistuje';
    END IF;

    UPDATE worker_attendance_records SET
      worker_id = p_worker_id,
      attendance_date = p_attendance_date,
      order_id = p_order_id,
      order_name = COALESCE(v_order_name, ''),
      work_start = p_work_start,
      work_end = p_work_end,
      break_minutes = COALESCE(p_break_minutes, 0),
      hours = v_hours,
      attendance_status = p_attendance_status,
      note = COALESCE(p_note, '')
    WHERE id = p_id;

    v_record_id := p_id;
  ELSE
    INSERT INTO worker_attendance_records (
      worker_id,
      form_id,
      attendance_date,
      order_id,
      order_name,
      hours,
      work_start,
      work_end,
      break_minutes,
      attendance_status,
      note
    )
    VALUES (
      p_worker_id,
      NULL,
      p_attendance_date,
      p_order_id,
      COALESCE(v_order_name, ''),
      v_hours,
      p_work_start,
      p_work_end,
      COALESCE(p_break_minutes, 0),
      p_attendance_status,
      COALESCE(p_note, '')
    )
    ON CONFLICT (worker_id, attendance_date)
    DO UPDATE SET
      order_id = EXCLUDED.order_id,
      order_name = EXCLUDED.order_name,
      hours = EXCLUDED.hours,
      work_start = EXCLUDED.work_start,
      work_end = EXCLUDED.work_end,
      break_minutes = EXCLUDED.break_minutes,
      attendance_status = EXCLUDED.attendance_status,
      note = EXCLUDED.note,
      form_id = COALESCE(worker_attendance_records.form_id, EXCLUDED.form_id)
    RETURNING id INTO v_record_id;
  END IF;

  IF p_attendance_status = 'pritomen' AND p_order_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM worker_reports
      WHERE worker_id = p_worker_id
        AND report_date = p_attendance_date
        AND form_id IS NULL
    ) THEN
      UPDATE worker_reports SET
        order_id = p_order_id,
        order_name = COALESCE(v_order_name, ''),
        activity = v_activity,
        hours = v_hours,
        note = COALESCE(p_note, '')
      WHERE worker_id = p_worker_id
        AND report_date = p_attendance_date
        AND form_id IS NULL;
    ELSE
      INSERT INTO worker_reports (
        worker_id, form_id, report_date, order_id, order_name, activity,
        hours, meters, pieces, earnings, material, advance, note, status
      )
      VALUES (
        p_worker_id, NULL, p_attendance_date, p_order_id, COALESCE(v_order_name, ''), v_activity,
        v_hours, 0, 0, 0, '', 0, COALESCE(p_note, ''), 'cekajici'
      );
    END IF;
  END IF;

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (
    p_worker_id,
    CASE WHEN p_id IS NULL THEN 'Docházka vytvořena' ELSE 'Docházka upravena' END,
    jsonb_build_object(
      'attendance_id', v_record_id,
      'attendance_date', p_attendance_date,
      'attendance_status', p_attendance_status,
      'hours', v_hours,
      'order_id', p_order_id,
      'source', 'manual'
    ),
    p_performed_by
  );

  RETURN v_record_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_attendance(
  p_id UUID,
  p_performed_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record worker_attendance_records%ROWTYPE;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění pro správu docházky';
  END IF;

  SELECT * INTO v_record FROM worker_attendance_records WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Záznam docházky neexistuje';
  END IF;

  IF v_record.form_id IS NOT NULL THEN
    RAISE EXCEPTION 'Záznam z formuláře zaměstnance nelze smazat zde. Upravte nebo smažte formulář.';
  END IF;

  DELETE FROM worker_reports
  WHERE worker_id = v_record.worker_id
    AND report_date = v_record.attendance_date
    AND form_id IS NULL;

  DELETE FROM worker_attendance_records WHERE id = p_id;

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (
    v_record.worker_id,
    'Docházka smazána',
    jsonb_build_object(
      'attendance_id', p_id,
      'attendance_date', v_record.attendance_date,
      'source', 'manual'
    ),
    p_performed_by
  );
END;
$$;

CREATE OR REPLACE FUNCTION submit_worker_daily_form(p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id FOR UPDATE;

  IF v_form.status NOT IN ('koncept', 'k_oprave') THEN
    RAISE EXCEPTION 'Formulář nelze odeslat v aktuálním stavu';
  END IF;

  IF v_form.signature_data IS NULL OR v_form.signature_data = '' THEN
    RAISE EXCEPTION 'Formulář vyžaduje podpis zaměstnance';
  END IF;

  IF v_form.order_id IS NULL THEN
    RAISE EXCEPTION 'Formulář vyžaduje aktivní zakázku';
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(v_form.work_type, v_form.work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces,
    status = 'odeslany',
    submitted_at = now()
  WHERE id = p_form_id;

  IF EXISTS (SELECT 1 FROM worker_reports WHERE form_id = p_form_id) THEN
    UPDATE worker_reports SET
      report_date = v_form.form_date,
      order_id = v_form.order_id,
      order_name = v_form.order_name,
      activity = v_activity,
      hours = v_form.hours,
      meters = v_meters,
      pieces = v_pieces,
      earnings = v_earnings,
      material = COALESCE(v_form.material, ''),
      advance = COALESCE(v_form.advance, 0),
      note = v_form.note,
      status = 'cekajici'
    WHERE form_id = p_form_id;
  ELSE
    INSERT INTO worker_reports (
      worker_id, form_id, report_date, order_id, order_name, activity,
      hours, meters, pieces, earnings, material, advance, note, status
    )
    VALUES (
      v_form.worker_id, p_form_id, v_form.form_date, v_form.order_id, v_form.order_name, v_activity,
      v_form.hours, v_meters, v_pieces, v_earnings,
      COALESCE(v_form.material, ''), COALESCE(v_form.advance, 0), v_form.note, 'cekajici'
    );
  END IF;

  INSERT INTO worker_attendance_records (
    worker_id, form_id, attendance_date, order_id, order_name, hours, work_start, work_end, break_minutes,
    attendance_status, note
  )
  VALUES (
    v_form.worker_id, p_form_id, v_form.form_date, v_form.order_id, v_form.order_name, v_form.hours,
    v_form.work_start, v_form.work_end, COALESCE(v_form.break_minutes, 0),
    'pritomen', COALESCE(v_form.note, '')
  )
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET
    hours = worker_attendance_records.hours + EXCLUDED.hours,
    form_id = EXCLUDED.form_id,
    order_id = COALESCE(EXCLUDED.order_id, worker_attendance_records.order_id),
    order_name = COALESCE(NULLIF(EXCLUDED.order_name, ''), worker_attendance_records.order_name),
    work_start = COALESCE(EXCLUDED.work_start, worker_attendance_records.work_start),
    work_end = COALESCE(EXCLUDED.work_end, worker_attendance_records.work_end),
    break_minutes = worker_attendance_records.break_minutes + EXCLUDED.break_minutes,
    attendance_status = 'pritomen',
    note = COALESCE(NULLIF(EXCLUDED.note, ''), worker_attendance_records.note);

  INSERT INTO worker_statistics (worker_id, stat_date, earnings, hours, meters, orders_count, advances)
  VALUES (v_form.worker_id, v_form.form_date, v_earnings, v_form.hours, v_meters, 1, v_form.advance)
  ON CONFLICT (worker_id, stat_date)
  DO UPDATE SET
    earnings = worker_statistics.earnings + EXCLUDED.earnings,
    hours = worker_statistics.hours + EXCLUDED.hours,
    meters = worker_statistics.meters + EXCLUDED.meters,
    orders_count = worker_statistics.orders_count + 1,
    advances = worker_statistics.advances + EXCLUDED.advances;

  INSERT INTO worker_history (worker_id, action, details)
  VALUES (v_form.worker_id, 'Denní výkaz vytvořen', jsonb_build_object(
    'form_id', p_form_id,
    'order_id', v_form.order_id,
    'order_name', v_form.order_name,
    'form_date', v_form.form_date,
    'earnings', v_earnings,
    'advance', v_form.advance,
    'hours', v_form.hours
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_upsert_attendance(UUID, DATE, UUID, TIME, TIME, INTEGER, attendance_status, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_attendance(UUID, UUID) TO authenticated;

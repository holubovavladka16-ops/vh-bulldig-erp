-- Formulář dělníka: správný typ práce + validace výkonů při odeslání

ALTER TABLE worker_attendance_records
  ADD COLUMN IF NOT EXISTS daily_advance NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION portal_save_form(
  p_token UUID,
  p_form_id UUID,
  p_form_date DATE,
  p_order_id UUID,
  p_work_start TIME,
  p_work_end TIME,
  p_break_minutes INTEGER,
  p_advance NUMERIC,
  p_material TEXT,
  p_note TEXT,
  p_gps_lat NUMERIC,
  p_gps_lng NUMERIC,
  p_gps_accuracy NUMERIC,
  p_signature_data TEXT,
  p_task_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_worker_id UUID;
  v_order_name TEXT;
  v_form_id UUID;
  v_hours NUMERIC;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
  v_task_count INTEGER;
  v_work_type work_type;
BEGIN
  SELECT w.id INTO v_worker_id
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Neplatný přístup';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Vyberte aktivní zakázku';
  END IF;

  SELECT jo.name INTO v_order_name
  FROM job_orders jo
  WHERE jo.id = p_order_id AND jo.status = 'aktivni';

  IF v_order_name IS NULL THEN
    RAISE EXCEPTION 'Zakázka není aktivní nebo neexistuje';
  END IF;

  IF p_form_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM worker_daily_forms
      WHERE id = p_form_id AND worker_id = v_worker_id AND status IN ('koncept', 'k_oprave')
    ) THEN
      RAISE EXCEPTION 'Formulář nelze upravovat';
    END IF;
  END IF;

  v_hours := calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0));

  IF p_form_id IS NULL THEN
    INSERT INTO worker_daily_forms (
      worker_id, form_date, order_id, order_name, activity, work_type, work_description,
      work_start, work_end, break_minutes, hours, meters, pieces,
      advance, material, note, gps_lat, gps_lng, gps_accuracy, signature_data, earnings
    )
    VALUES (
      v_worker_id, p_form_date, p_order_id, v_order_name, '', 'ukolova', '',
      p_work_start, p_work_end, COALESCE(p_break_minutes, 0), v_hours, 0, 0,
      COALESCE(p_advance, 0), COALESCE(p_material, ''), p_note,
      p_gps_lat, p_gps_lng, p_gps_accuracy, p_signature_data, 0
    )
    RETURNING id INTO v_form_id;
  ELSE
    UPDATE worker_daily_forms SET
      form_date = p_form_date,
      order_id = p_order_id,
      order_name = v_order_name,
      work_start = p_work_start,
      work_end = p_work_end,
      break_minutes = COALESCE(p_break_minutes, 0),
      hours = v_hours,
      advance = COALESCE(p_advance, 0),
      material = COALESCE(p_material, ''),
      note = p_note,
      gps_lat = p_gps_lat,
      gps_lng = p_gps_lng,
      gps_accuracy = p_gps_accuracy,
      signature_data = p_signature_data,
      price_item_id = NULL
    WHERE id = p_form_id AND worker_id = v_worker_id
    RETURNING id INTO v_form_id;
  END IF;

  PERFORM save_form_task_items(v_form_id, v_worker_id, p_task_items);

  SELECT COUNT(*) INTO v_task_count
  FROM worker_form_task_items
  WHERE form_id = v_form_id AND quantity > 0;

  v_work_type := CASE
    WHEN v_hours > 0 AND v_task_count > 0 THEN 'kombinovana'::work_type
    WHEN v_hours > 0 THEN 'hodinova'::work_type
    ELSE 'ukolova'::work_type
  END;

  UPDATE worker_daily_forms SET work_type = v_work_type WHERE id = v_form_id;

  v_earnings := calculate_form_earnings(v_form_id);
  v_activity := derive_form_activity(v_work_type, '', v_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(v_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces
  WHERE id = v_form_id;

  RETURN v_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION submit_worker_daily_form(p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
  v_task_count INTEGER;
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

  SELECT COUNT(*) INTO v_task_count
  FROM worker_form_task_items
  WHERE form_id = p_form_id AND quantity > 0;

  IF v_task_count = 0 THEN
    RAISE EXCEPTION 'Přidejte alespoň jeden výkon z ceníku s množstvím větším než 0';
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
    worker_id, form_id, attendance_date, order_id, order_name, hours, work_start, work_end, break_minutes, daily_advance
  )
  VALUES (
    v_form.worker_id, p_form_id, v_form.form_date, v_form.order_id, v_form.order_name, v_form.hours,
    v_form.work_start, v_form.work_end, COALESCE(v_form.break_minutes, 0), COALESCE(v_form.advance, 0)
  )
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET
    hours = EXCLUDED.hours,
    form_id = EXCLUDED.form_id,
    order_id = EXCLUDED.order_id,
    order_name = EXCLUDED.order_name,
    work_start = EXCLUDED.work_start,
    work_end = EXCLUDED.work_end,
    break_minutes = EXCLUDED.break_minutes,
    daily_advance = EXCLUDED.daily_advance;

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
    'form_date', v_form.form_date,
    'order_name', v_form.order_name,
    'earnings', v_earnings,
    'advance', v_form.advance,
    'hours', v_form.hours,
    'material', v_form.material,
    'gps_lat', v_form.gps_lat,
    'gps_lng', v_form.gps_lng
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION portal_save_form(
  UUID, UUID, DATE, UUID, TIME, TIME, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB
) TO anon, authenticated;

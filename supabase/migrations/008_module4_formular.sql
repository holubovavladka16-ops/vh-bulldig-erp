-- Modul 4 – Formulář zaměstnance (denní výkaz)
-- Spusťte po 007_module3_osobni_cenik.sql

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS assigned_order TEXT NOT NULL DEFAULT '';

ALTER TABLE worker_daily_forms
  ADD COLUMN IF NOT EXISTS work_start TIME,
  ADD COLUMN IF NOT EXISTS work_end TIME,
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gps_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS gps_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS gps_accuracy NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS signature_data TEXT;

ALTER TABLE worker_attendance_records
  ADD COLUMN IF NOT EXISTS work_start TIME,
  ADD COLUMN IF NOT EXISTS work_end TIME,
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE worker_reports
  ADD COLUMN IF NOT EXISTS material TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION calc_work_hours(
  p_start TIME,
  p_end TIME,
  p_break_minutes INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  v_minutes NUMERIC;
BEGIN
  IF p_start IS NULL OR p_end IS NULL THEN
    RETURN 0;
  END IF;

  v_minutes := EXTRACT(EPOCH FROM (p_end - p_start)) / 60;
  IF v_minutes < 0 THEN
    v_minutes := v_minutes + 24 * 60;
  END IF;

  RETURN GREATEST(0, ROUND((v_minutes - COALESCE(p_break_minutes, 0)) / 60.0, 2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP FUNCTION IF EXISTS public.portal_get_worker(uuid) CASCADE;

CREATE OR REPLACE FUNCTION portal_get_worker(p_token UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  "position" TEXT,
  status worker_status,
  employment_type employment_type,
  assigned_order TEXT
) AS $$
  SELECT
    w.id,
    w.first_name,
    w.last_name,
    w."position",
    w.status,
    w.employment_type,
    COALESCE(w.assigned_order, '')
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION portal_get_daily_advances(p_token UUID)
RETURNS TABLE (
  form_date DATE,
  advance NUMERIC,
  earnings NUMERIC,
  status worker_form_status
) AS $$
  SELECT f.form_date, f.advance, f.earnings, f.status
  FROM worker_daily_forms f
  JOIN workers w ON w.id = f.worker_id
  WHERE w.portal_token = p_token
    AND w.status = 'aktivni'
    AND f.advance > 0
    AND f.status IN ('odeslany', 'schvaleny')
  ORDER BY f.form_date DESC
  LIMIT 30;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION save_form_task_items(
  p_form_id UUID,
  p_worker_id UUID,
  p_task_items JSONB
) RETURNS VOID AS $$
DECLARE
  v_item JSONB;
  v_price_item worker_price_items%ROWTYPE;
  v_quantity NUMERIC;
  v_earnings NUMERIC;
  v_sort INTEGER := 0;
BEGIN
  DELETE FROM worker_form_task_items WHERE form_id = p_form_id;

  IF p_task_items IS NULL OR jsonb_array_length(p_task_items) = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_task_items)
  LOOP
    v_sort := v_sort + 1;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    SELECT * INTO v_price_item FROM worker_price_items
    WHERE id = (v_item->>'price_item_id')::UUID
      AND worker_id = p_worker_id
      AND is_active = true;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_earnings := calculate_task_line_earnings(v_price_item.unit_type, v_price_item.price, v_quantity);

    INSERT INTO worker_form_task_items (form_id, price_item_id, quantity, line_earnings, sort_order)
    VALUES (p_form_id, v_price_item.id, v_quantity, v_earnings, v_sort);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS portal_save_form(UUID, UUID, DATE, TEXT, work_type, TEXT, NUMERIC, NUMERIC, TEXT, JSONB);

CREATE OR REPLACE FUNCTION portal_save_form(
  p_token UUID,
  p_form_id UUID,
  p_form_date DATE,
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
BEGIN
  SELECT w.id, COALESCE(w.assigned_order, '')
  INTO v_worker_id, v_order_name
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Neplatný přístup';
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
      worker_id, form_date, order_name, activity, work_type, work_description,
      work_start, work_end, break_minutes, hours, meters, pieces,
      advance, material, note, gps_lat, gps_lng, gps_accuracy, signature_data, earnings
    )
    VALUES (
      v_worker_id, p_form_date, v_order_name, '', 'ukolova', '',
      p_work_start, p_work_end, COALESCE(p_break_minutes, 0), v_hours, 0, 0,
      COALESCE(p_advance, 0), COALESCE(p_material, ''), p_note,
      p_gps_lat, p_gps_lng, p_gps_accuracy, p_signature_data, 0
    )
    RETURNING id INTO v_form_id;
  ELSE
    UPDATE worker_daily_forms SET
      form_date = p_form_date,
      order_name = v_order_name,
      work_type = 'ukolova',
      work_description = '',
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

  v_earnings := calculate_form_earnings(v_form_id);
  v_activity := derive_form_activity('ukolova', '', v_form_id);

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

DROP FUNCTION IF EXISTS admin_save_form(UUID, DATE, TEXT, work_type, TEXT, NUMERIC, NUMERIC, TEXT, JSONB);

CREATE OR REPLACE FUNCTION admin_save_form(
  p_form_id UUID,
  p_form_date DATE,
  p_order_name TEXT,
  p_work_type work_type,
  p_work_description TEXT,
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
  v_hours NUMERIC;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT worker_id INTO v_worker_id FROM worker_daily_forms WHERE id = p_form_id;
  IF v_worker_id IS NULL THEN RAISE EXCEPTION 'Formulář nenalezen'; END IF;

  v_hours := calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0));

  UPDATE worker_daily_forms SET
    form_date = p_form_date,
    order_name = p_order_name,
    work_type = p_work_type,
    work_description = COALESCE(p_work_description, ''),
    work_start = p_work_start,
    work_end = p_work_end,
    break_minutes = COALESCE(p_break_minutes, 0),
    hours = v_hours,
    advance = p_advance,
    material = COALESCE(p_material, ''),
    note = p_note,
    gps_lat = p_gps_lat,
    gps_lng = p_gps_lng,
    gps_accuracy = p_gps_accuracy,
    signature_data = p_signature_data
  WHERE id = p_form_id;

  IF p_work_type IN ('ukolova', 'kombinovana') THEN
    PERFORM save_form_task_items(p_form_id, v_worker_id, p_task_items);
  ELSE
    DELETE FROM worker_form_task_items WHERE form_id = p_form_id;
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(p_work_type, p_work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces
  WHERE id = p_form_id;

  RETURN p_form_id;
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
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id FOR UPDATE;

  IF v_form.status NOT IN ('koncept', 'k_oprave') THEN
    RAISE EXCEPTION 'Formulář nelze odeslat v aktuálním stavu';
  END IF;

  IF v_form.signature_data IS NULL OR v_form.signature_data = '' THEN
    RAISE EXCEPTION 'Formulář vyžaduje podpis zaměstnance';
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
      order_name = v_form.order_name,
      activity = v_activity,
      hours = v_form.hours,
      meters = v_meters,
      pieces = v_pieces,
      earnings = v_earnings,
      material = COALESCE(v_form.material, ''),
      status = 'cekajici'
    WHERE form_id = p_form_id;
  ELSE
    INSERT INTO worker_reports (
      worker_id, form_id, report_date, order_name, activity,
      hours, meters, pieces, earnings, material, status
    )
    VALUES (
      v_form.worker_id, p_form_id, v_form.form_date, v_form.order_name, v_activity,
      v_form.hours, v_meters, v_pieces, v_earnings, COALESCE(v_form.material, ''), 'cekajici'
    );
  END IF;

  INSERT INTO worker_attendance_records (
    worker_id, form_id, attendance_date, hours, work_start, work_end, break_minutes
  )
  VALUES (
    v_form.worker_id, p_form_id, v_form.form_date, v_form.hours,
    v_form.work_start, v_form.work_end, COALESCE(v_form.break_minutes, 0)
  )
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET
    hours = worker_attendance_records.hours + EXCLUDED.hours,
    form_id = EXCLUDED.form_id,
    work_start = EXCLUDED.work_start,
    work_end = EXCLUDED.work_end,
    break_minutes = EXCLUDED.break_minutes;

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
  VALUES (v_form.worker_id, 'Denní formulář odeslán', jsonb_build_object(
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

GRANT EXECUTE ON FUNCTION portal_get_daily_advances(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calc_work_hours(TIME, TIME, INTEGER) TO anon, authenticated;

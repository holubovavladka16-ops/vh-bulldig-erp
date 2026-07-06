-- Popis práce v portálovém denním formuláři + AI úprava textu

DROP FUNCTION IF EXISTS portal_save_form(UUID, UUID, DATE, UUID, TIME, TIME, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB);

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
  p_task_items JSONB,
  p_work_description TEXT DEFAULT ''
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
      v_worker_id, p_form_date, p_order_id, v_order_name, '', 'ukolova',
      COALESCE(p_work_description, ''),
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
      work_description = COALESCE(p_work_description, ''),
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
  v_activity := derive_form_activity(v_work_type, COALESCE(p_work_description, ''), v_form_id);

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

GRANT EXECUTE ON FUNCTION portal_save_form(UUID, UUID, DATE, UUID, TIME, TIME, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, TEXT) TO anon, authenticated;

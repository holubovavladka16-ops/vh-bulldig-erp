-- Modul 5 – Docházka zaměstnanců a denní výkazy
-- Spusťte po 008_module4_formular.sql

ALTER TABLE worker_attendance_records
  ADD COLUMN IF NOT EXISTS order_name TEXT NOT NULL DEFAULT '';

ALTER TABLE worker_reports
  ADD COLUMN IF NOT EXISTS advance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Docházka: doplnění zakázky u existujících záznamů z formuláře
UPDATE worker_attendance_records a
SET order_name = COALESCE(f.order_name, '')
FROM worker_daily_forms f
WHERE f.id = a.form_id AND (a.order_name IS NULL OR a.order_name = '');

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
      advance = COALESCE(v_form.advance, 0),
      note = v_form.note,
      status = 'cekajici'
    WHERE form_id = p_form_id;
  ELSE
    INSERT INTO worker_reports (
      worker_id, form_id, report_date, order_name, activity,
      hours, meters, pieces, earnings, material, advance, note, status
    )
    VALUES (
      v_form.worker_id, p_form_id, v_form.form_date, v_form.order_name, v_activity,
      v_form.hours, v_meters, v_pieces, v_earnings,
      COALESCE(v_form.material, ''), COALESCE(v_form.advance, 0), v_form.note, 'cekajici'
    );
  END IF;

  INSERT INTO worker_attendance_records (
    worker_id, form_id, attendance_date, order_name, hours, work_start, work_end, break_minutes
  )
  VALUES (
    v_form.worker_id, p_form_id, v_form.form_date, v_form.order_name, v_form.hours,
    v_form.work_start, v_form.work_end, COALESCE(v_form.break_minutes, 0)
  )
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET
    hours = EXCLUDED.hours,
    form_id = EXCLUDED.form_id,
    order_name = EXCLUDED.order_name,
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

  UPDATE worker_reports SET
    report_date = p_form_date,
    order_name = p_order_name,
    activity = v_activity,
    hours = v_hours,
    meters = v_meters,
    pieces = v_pieces,
    earnings = v_earnings,
    material = COALESCE(p_material, ''),
    advance = COALESCE(p_advance, 0),
    note = p_note
  WHERE form_id = p_form_id;

  UPDATE worker_attendance_records SET
    attendance_date = p_form_date,
    order_name = p_order_name,
    hours = v_hours,
    work_start = p_work_start,
    work_end = p_work_end,
    break_minutes = COALESCE(p_break_minutes, 0)
  WHERE form_id = p_form_id;

  RETURN p_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION portal_get_attendance(p_token UUID)
RETURNS TABLE (
  id UUID,
  attendance_date DATE,
  order_name TEXT,
  work_start TIME,
  work_end TIME,
  break_minutes INTEGER,
  hours NUMERIC
) AS $$
  SELECT
    a.id,
    a.attendance_date,
    COALESCE(NULLIF(a.order_name, ''), f.order_name, ''),
    a.work_start,
    a.work_end,
    a.break_minutes,
    a.hours
  FROM worker_attendance_records a
  JOIN workers w ON w.id = a.worker_id
  LEFT JOIN worker_daily_forms f ON f.id = a.form_id
  WHERE w.portal_token = p_token AND w.status = 'aktivni'
  ORDER BY a.attendance_date DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_report_detail(p_report_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF get_user_role() NOT IN ('administrator', 'vedouci') THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT jsonb_build_object(
    'report', to_jsonb(r.*),
    'form', CASE WHEN f.id IS NOT NULL THEN to_jsonb(f.*) ELSE NULL END,
    'worker', jsonb_build_object(
      'first_name', w.first_name,
      'last_name', w.last_name,
      'position', w."position"
    ),
    'task_items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ti.id,
          'price_item_id', ti.price_item_id,
          'name', pi.name,
          'unit_type', pi.unit_type,
          'price', pi.price,
          'quantity', ti.quantity,
          'line_earnings', ti.line_earnings,
          'sort_order', ti.sort_order
        ) ORDER BY ti.sort_order
      )
      FROM worker_form_task_items ti
      JOIN worker_price_items pi ON pi.id = ti.price_item_id
      WHERE ti.form_id = f.id
    ), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at)
      FROM worker_form_photos p
      WHERE p.form_id = f.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM worker_reports r
  JOIN workers w ON w.id = r.worker_id
  LEFT JOIN worker_daily_forms f ON f.id = r.form_id
  WHERE r.id = p_report_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Výkaz nenalezen';
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION portal_get_report_detail(p_token UUID, p_report_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_worker_id UUID;
  v_result JSONB;
BEGIN
  SELECT w.id INTO v_worker_id
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Neplatný přístup';
  END IF;

  SELECT jsonb_build_object(
    'report', to_jsonb(r.*),
    'form', CASE WHEN f.id IS NOT NULL THEN to_jsonb(f.*) ELSE NULL END,
    'worker', jsonb_build_object(
      'first_name', w.first_name,
      'last_name', w.last_name,
      'position', w."position"
    ),
    'task_items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ti.id,
          'price_item_id', ti.price_item_id,
          'name', pi.name,
          'unit_type', pi.unit_type,
          'price', pi.price,
          'quantity', ti.quantity,
          'line_earnings', ti.line_earnings,
          'sort_order', ti.sort_order
        ) ORDER BY ti.sort_order
      )
      FROM worker_form_task_items ti
      JOIN worker_price_items pi ON pi.id = ti.price_item_id
      WHERE ti.form_id = f.id
    ), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at)
      FROM worker_form_photos p
      WHERE p.form_id = f.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM worker_reports r
  JOIN workers w ON w.id = r.worker_id
  LEFT JOIN worker_daily_forms f ON f.id = r.form_id
  WHERE r.id = p_report_id AND r.worker_id = v_worker_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Výkaz nenalezen';
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION delete_daily_report(p_report_id UUID)
RETURNS VOID AS $$
DECLARE
  v_report worker_reports%ROWTYPE;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_report FROM worker_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Výkaz nenalezen'; END IF;

  DELETE FROM worker_reports WHERE id = p_report_id;

  INSERT INTO worker_history (worker_id, action, details)
  VALUES (v_report.worker_id, 'Denní výkaz smazán', jsonb_build_object(
    'report_id', p_report_id,
    'form_id', v_report.form_id
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION approve_daily_report(p_report_id UUID, p_approved_by UUID)
RETURNS VOID AS $$
DECLARE
  v_report worker_reports%ROWTYPE;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_report FROM worker_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Výkaz nenalezen'; END IF;

  UPDATE worker_reports SET status = 'schvaleny' WHERE id = p_report_id;

  IF v_report.form_id IS NOT NULL THEN
    UPDATE worker_daily_forms SET status = 'schvaleny', approved_by = p_approved_by
    WHERE id = v_report.form_id;
  END IF;

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (v_report.worker_id, 'Denní výkaz schválen', jsonb_build_object(
    'report_id', p_report_id,
    'form_id', v_report.form_id
  ), p_approved_by);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION return_daily_report(p_report_id UUID, p_performed_by UUID)
RETURNS VOID AS $$
DECLARE
  v_report worker_reports%ROWTYPE;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_report FROM worker_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Výkaz nenalezen'; END IF;

  UPDATE worker_reports SET status = 'k_oprave' WHERE id = p_report_id;

  IF v_report.form_id IS NOT NULL THEN
    UPDATE worker_daily_forms SET status = 'k_oprave' WHERE id = v_report.form_id;
  END IF;

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (v_report.worker_id, 'Denní výkaz vrácen k opravě', jsonb_build_object(
    'report_id', p_report_id,
    'form_id', v_report.form_id
  ), p_performed_by);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION portal_get_attendance(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_report_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION portal_get_report_detail(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_daily_report(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_daily_report(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION return_daily_report(UUID, UUID) TO authenticated;

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id IN ('dochazka', 'vykazy');

-- Jednotný datový tok: formulář → výkony → docházka → výkazy → statistiky
-- Jediný zdroj pravdy: worker_daily_forms + worker_form_task_items

CREATE OR REPLACE FUNCTION recalculate_worker_statistics(p_worker_id UUID, p_stat_date DATE)
RETURNS VOID AS $$
DECLARE
  v_totals RECORD;
BEGIN
  SELECT
    COALESCE(SUM(f.earnings), 0) AS earnings,
    COALESCE(SUM(f.hours), 0) AS hours,
    COALESCE(SUM(f.meters), 0) AS meters,
    COUNT(*)::INTEGER AS orders_count,
    COALESCE(SUM(f.advance), 0) AS advances
  INTO v_totals
  FROM worker_daily_forms f
  WHERE f.worker_id = p_worker_id
    AND f.form_date = p_stat_date
    AND f.status IN ('odeslany', 'schvaleny');

  IF v_totals.orders_count = 0 THEN
    DELETE FROM worker_statistics
    WHERE worker_id = p_worker_id AND stat_date = p_stat_date;
    RETURN;
  END IF;

  INSERT INTO worker_statistics (worker_id, stat_date, earnings, hours, meters, orders_count, advances)
  VALUES (
    p_worker_id, p_stat_date,
    v_totals.earnings, v_totals.hours, v_totals.meters,
    v_totals.orders_count, v_totals.advances
  )
  ON CONFLICT (worker_id, stat_date)
  DO UPDATE SET
    earnings = EXCLUDED.earnings,
    hours = EXCLUDED.hours,
    meters = EXCLUDED.meters,
    orders_count = EXCLUDED.orders_count,
    advances = EXCLUDED.advances;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION sync_form_downstream(p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulář nenalezen';
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(v_form.work_type, v_form.work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces
  WHERE id = p_form_id;

  IF v_form.status NOT IN ('odeslany', 'schvaleny') THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM worker_reports WHERE form_id = p_form_id) THEN
    UPDATE worker_reports SET
      worker_id = v_form.worker_id,
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
      note = v_form.note
    WHERE form_id = p_form_id;
  ELSE
    INSERT INTO worker_reports (
      worker_id, form_id, report_date, order_id, order_name, activity,
      hours, meters, pieces, earnings, material, advance, note, status
    )
    VALUES (
      v_form.worker_id, p_form_id, v_form.form_date, v_form.order_id, v_form.order_name, v_activity,
      v_form.hours, v_meters, v_pieces, v_earnings,
      COALESCE(v_form.material, ''), COALESCE(v_form.advance, 0), COALESCE(v_form.note, ''), 'cekajici'
    );
  END IF;

  INSERT INTO worker_attendance_records (
    worker_id, form_id, attendance_date, order_id, order_name, hours,
    work_start, work_end, break_minutes, daily_advance, attendance_status, note
  )
  VALUES (
    v_form.worker_id, p_form_id, v_form.form_date, v_form.order_id, v_form.order_name, v_form.hours,
    v_form.work_start, v_form.work_end, COALESCE(v_form.break_minutes, 0),
    COALESCE(v_form.advance, 0), 'pritomen', COALESCE(v_form.note, '')
  )
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET
    form_id = EXCLUDED.form_id,
    order_id = EXCLUDED.order_id,
    order_name = EXCLUDED.order_name,
    hours = EXCLUDED.hours,
    work_start = EXCLUDED.work_start,
    work_end = EXCLUDED.work_end,
    break_minutes = EXCLUDED.break_minutes,
    daily_advance = EXCLUDED.daily_advance,
    attendance_status = 'pritomen',
    note = EXCLUDED.note;

  PERFORM recalculate_worker_statistics(v_form.worker_id, v_form.form_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION submit_worker_daily_form(p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
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

  IF v_task_count = 0 AND COALESCE(v_form.hours, 0) <= 0 THEN
    RAISE EXCEPTION 'Zadejte pracovní dobu nebo alespoň jeden výkon z ceníku';
  END IF;

  UPDATE worker_daily_forms SET
    status = 'odeslany',
    submitted_at = now()
  WHERE id = p_form_id;

  PERFORM sync_form_downstream(p_form_id);

  INSERT INTO worker_history (worker_id, action, details)
  VALUES (v_form.worker_id, 'Denní výkaz vytvořen', jsonb_build_object(
    'form_id', p_form_id,
    'form_date', v_form.form_date,
    'order_name', v_form.order_name,
    'source', 'portal'
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Náhled mezd včetně čekajících výkazů (pro okamžitou viditelnost po odeslání formuláře)
DROP FUNCTION IF EXISTS get_payroll_slip_summaries(DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION get_payroll_slip_summaries(
  p_date_from DATE,
  p_date_to DATE,
  p_worker_id UUID DEFAULT NULL,
  p_include_pending BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  worker_id UUID,
  worker_first_name TEXT,
  worker_last_name TEXT,
  report_count BIGINT,
  total_earnings NUMERIC,
  total_advances NUMERIC,
  net_amount NUMERIC,
  pending_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.first_name,
    w.last_name,
    COUNT(r.id) FILTER (WHERE r.status = 'schvaleny') AS report_count,
    COALESCE(SUM(r.earnings) FILTER (WHERE r.status = 'schvaleny'), 0) AS total_earnings,
    COALESCE(SUM(r.advance) FILTER (WHERE r.status = 'schvaleny'), 0) AS total_advances,
    COALESCE(SUM(r.earnings) FILTER (WHERE r.status = 'schvaleny'), 0)
      - COALESCE(SUM(r.advance) FILTER (WHERE r.status = 'schvaleny'), 0) AS net_amount,
    COUNT(r.id) FILTER (WHERE r.status = 'cekajici') AS pending_count
  FROM workers w
  LEFT JOIN worker_reports r ON r.worker_id = w.id
    AND r.report_date >= p_date_from
    AND r.report_date <= p_date_to
    AND (p_include_pending OR r.status = 'schvaleny')
  WHERE w.status = 'aktivni'
    AND (p_worker_id IS NULL OR w.id = p_worker_id)
  GROUP BY w.id, w.first_name, w.last_name
  HAVING COUNT(r.id) > 0
     OR (p_include_pending AND COUNT(r.id) FILTER (WHERE r.status = 'cekajici') > 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION sync_form_downstream(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_worker_statistics(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payroll_slip_summaries(DATE, DATE, UUID, BOOLEAN) TO authenticated;

-- Admin docházka: jednotný tok přes sync_form_downstream (bez duplicitní logiky)
CREATE OR REPLACE FUNCTION admin_upsert_attendance(
  p_worker_id UUID,
  p_attendance_date DATE,
  p_order_id UUID,
  p_advance NUMERIC,
  p_note TEXT,
  p_task_items JSONB,
  p_work_start TIME DEFAULT NULL,
  p_work_end TIME DEFAULT NULL,
  p_break_minutes INTEGER DEFAULT 0,
  p_id UUID DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_name TEXT;
  v_form_id UUID;
  v_hours NUMERIC(8, 2) := 0;
  v_calc_hours NUMERIC(8, 2) := 0;
  v_hodina_id UUID;
  v_item JSONB;
  v_has_tasks BOOLEAN := false;
  v_work_type work_type;
  v_earnings NUMERIC;
  v_attendance_id UUID;
  v_existing_form_id UUID;
  v_filtered_items JSONB := '[]'::jsonb;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění pro správu docházky';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Vyberte zakázku';
  END IF;

  SELECT name INTO v_order_name FROM job_orders WHERE id = p_order_id;
  IF v_order_name IS NULL THEN
    RAISE EXCEPTION 'Zakázka neexistuje';
  END IF;

  v_calc_hours := COALESCE(calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0)), 0);

  SELECT id INTO v_hodina_id
  FROM worker_price_items
  WHERE worker_id = p_worker_id AND name = 'Hodinová sazba' AND is_active = true
  LIMIT 1;

  IF p_task_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_task_items)
    LOOP
      IF v_hodina_id IS NOT NULL AND (v_item->>'price_item_id')::UUID = v_hodina_id THEN
        v_hours := COALESCE((v_item->>'quantity')::NUMERIC, 0);
      ELSIF COALESCE((v_item->>'quantity')::NUMERIC, 0) > 0
        AND (v_hodina_id IS NULL OR (v_item->>'price_item_id')::UUID <> v_hodina_id) THEN
        v_has_tasks := true;
        v_filtered_items := v_filtered_items || jsonb_build_array(v_item);
      END IF;
    END LOOP;
  END IF;

  IF p_work_start IS NOT NULL AND p_work_end IS NOT NULL AND v_calc_hours > 0 THEN
    v_hours := v_calc_hours;
  END IF;

  v_work_type := CASE
    WHEN v_hours > 0 AND v_has_tasks THEN 'kombinovana'::work_type
    WHEN v_hours > 0 THEN 'hodinova'::work_type
    ELSE 'ukolova'::work_type
  END;

  IF p_id IS NOT NULL THEN
    SELECT form_id INTO v_existing_form_id FROM worker_attendance_records WHERE id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Záznam docházky neexistuje';
    END IF;
  END IF;

  IF v_existing_form_id IS NOT NULL THEN
    v_form_id := v_existing_form_id;

    UPDATE worker_daily_forms SET
      form_date = p_attendance_date,
      order_id = p_order_id,
      order_name = v_order_name,
      work_type = v_work_type,
      work_start = p_work_start,
      work_end = p_work_end,
      break_minutes = COALESCE(p_break_minutes, 0),
      hours = v_hours,
      advance = COALESCE(p_advance, 0),
      note = COALESCE(p_note, '')
    WHERE id = v_form_id;
  ELSE
    INSERT INTO worker_daily_forms (
      worker_id, form_date, order_id, order_name, activity, work_type, work_description,
      work_start, work_end, break_minutes, hours, advance, note, status, signature_data
    )
    VALUES (
      p_worker_id, p_attendance_date, p_order_id, v_order_name, '', v_work_type, 'Ruční zápis docházky',
      p_work_start, p_work_end, COALESCE(p_break_minutes, 0), v_hours, COALESCE(p_advance, 0),
      COALESCE(p_note, ''), 'odeslany', 'admin-manual'
    )
    RETURNING id INTO v_form_id;
  END IF;

  IF v_work_type IN ('ukolova', 'kombinovana') THEN
    PERFORM save_form_task_items(v_form_id, p_worker_id, v_filtered_items);
  ELSE
    DELETE FROM worker_form_task_items WHERE form_id = v_form_id;
  END IF;

  UPDATE worker_daily_forms SET status = 'odeslany'
  WHERE id = v_form_id AND status NOT IN ('schvaleny');

  PERFORM sync_form_downstream(v_form_id);

  SELECT earnings INTO v_earnings FROM worker_daily_forms WHERE id = v_form_id;

  IF p_id IS NOT NULL THEN
    v_attendance_id := p_id;
  ELSE
    SELECT id INTO v_attendance_id
    FROM worker_attendance_records
    WHERE worker_id = p_worker_id AND attendance_date = p_attendance_date;
  END IF;

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (
    p_worker_id,
    CASE WHEN v_existing_form_id IS NULL THEN 'Docházka vytvořena' ELSE 'Docházka upravena' END,
    jsonb_build_object(
      'attendance_id', v_attendance_id,
      'form_id', v_form_id,
      'attendance_date', p_attendance_date,
      'advance', COALESCE(p_advance, 0),
      'hours', v_hours,
      'earnings', v_earnings,
      'order_id', p_order_id,
      'source', 'manual'
    ),
    p_performed_by
  );

  RETURN v_attendance_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_attendance(
  UUID, DATE, UUID, NUMERIC, TEXT, JSONB, TIME, TIME, INTEGER, UUID, UUID
) TO authenticated;

NOTIFY pgrst, 'reload schema';

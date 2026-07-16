-- Oprava PGRST202: produkční DB měla admin_upsert_attendance bez p_status (migrace 035),
-- frontend volá RPC s p_status od migrace 042. Sjednocení na jednu signaturu včetně p_status
-- (logika z migrace 043 – docházkové hodiny odděleně od výdělku).

DROP FUNCTION IF EXISTS admin_upsert_attendance(UUID, DATE, UUID, TIME, TIME, INTEGER, attendance_status, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS admin_upsert_attendance(UUID, DATE, UUID, NUMERIC, TEXT, JSONB, UUID, UUID);
DROP FUNCTION IF EXISTS admin_upsert_attendance(UUID, DATE, UUID, NUMERIC, TEXT, JSONB, TIME, TIME, INTEGER, UUID, UUID);
DROP FUNCTION IF EXISTS admin_upsert_attendance(UUID, DATE, UUID, NUMERIC, TEXT, JSONB, TIME, TIME, INTEGER, UUID, UUID, attendance_status);

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
  p_performed_by UUID DEFAULT NULL,
  p_status attendance_status DEFAULT 'pritomen'
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

  v_hours := COALESCE(calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0)), 0);

  IF p_task_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_task_items)
    LOOP
      IF COALESCE((v_item->>'quantity')::NUMERIC, 0) > 0 THEN
        v_has_tasks := true;
        v_filtered_items := v_filtered_items || jsonb_build_array(v_item);
      END IF;
    END LOOP;
  END IF;

  v_work_type := CASE
    WHEN v_hours > 0 AND v_has_tasks THEN 'kombinovana'::work_type
    WHEN v_has_tasks THEN 'ukolova'::work_type
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

  PERFORM save_form_task_items(v_form_id, p_worker_id, v_filtered_items);

  UPDATE worker_daily_forms SET status = 'odeslany'
  WHERE id = v_form_id AND status NOT IN ('schvaleny');

  PERFORM sync_form_downstream(v_form_id);

  IF p_status IS DISTINCT FROM 'pritomen' THEN
    UPDATE worker_attendance_records
    SET attendance_status = p_status
    WHERE worker_id = p_worker_id AND attendance_date = p_attendance_date;
  END IF;

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
      'attendance_status', p_status,
      'advance', COALESCE(p_advance, 0),
      'attendance_hours', v_hours,
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
  UUID, DATE, UUID, NUMERIC, TEXT, JSONB, TIME, TIME, INTEGER, UUID, UUID, attendance_status
) TO authenticated;

NOTIFY pgrst, 'reload schema';

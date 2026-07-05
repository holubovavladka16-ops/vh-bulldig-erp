-- Modul 6 – Zakázky
-- Spusťte po 009_module5_dochazka_vykazy.sql

CREATE TYPE job_order_status AS ENUM (
  'pripravuje_se',
  'aktivni',
  'pozastavena',
  'dokoncena',
  'archivovana'
);

CREATE TABLE job_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  work_description TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  order_number TEXT,
  investor TEXT,
  client_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  gps_lat NUMERIC(10, 7),
  gps_lng NUMERIC(10, 7),
  gps_accuracy NUMERIC(10, 2),
  note TEXT,
  status job_order_status NOT NULL DEFAULT 'pripravuje_se',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_orders_dates_check CHECK (end_date >= start_date)
);

CREATE TABLE job_order_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_orders_status ON job_orders(status);
CREATE INDEX idx_job_orders_name ON job_orders(name);
CREATE INDEX idx_job_orders_location ON job_orders(location);
CREATE INDEX idx_job_orders_dates ON job_orders(start_date, end_date);

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS assigned_order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL;

ALTER TABLE worker_daily_forms
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL;

ALTER TABLE worker_reports
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL;

ALTER TABLE worker_attendance_records
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL;

CREATE TRIGGER job_orders_updated_at
  BEFORE UPDATE ON job_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE job_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_order_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_order_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin a vedoucí čtou zakázky"
  ON job_orders FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje zakázky"
  ON job_orders FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin a vedoucí čtou dokumenty zakázky"
  ON job_order_documents FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje dokumenty zakázky"
  ON job_order_documents FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin a vedoucí čtou fotografie zakázky"
  ON job_order_photos FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje fotografie zakázky"
  ON job_order_photos FOR ALL
  USING (get_user_role() = 'administrator');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('order-photos', 'order-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('order-documents', 'order-documents', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin nahrává fotografie zakázky"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-photos');

CREATE POLICY "Veřejné čtení fotografií zakázky"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'order-photos');

CREATE POLICY "Admin nahrává PDF zakázky"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-documents');

CREATE POLICY "Autentizovaní čtou PDF zakázky"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'order-documents');

CREATE OR REPLACE FUNCTION portal_get_active_orders(p_token UUID)
RETURNS TABLE (id UUID, name TEXT, location TEXT) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workers w WHERE w.portal_token = p_token AND w.status = 'aktivni'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT jo.id, jo.name, jo.location
  FROM job_orders jo
  WHERE jo.status = 'aktivni'
  ORDER BY jo.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP FUNCTION IF EXISTS portal_save_form(UUID, UUID, DATE, TIME, TIME, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB);

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

DROP FUNCTION IF EXISTS public.portal_get_worker(uuid) CASCADE;

CREATE OR REPLACE FUNCTION portal_get_worker(p_token UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  "position" TEXT,
  status worker_status,
  employment_type employment_type,
  assigned_order TEXT,
  assigned_order_id UUID
) AS $$
  SELECT
    w.id,
    w.first_name,
    w.last_name,
    w."position",
    w.status,
    w.employment_type,
    COALESCE(jo.name, w.assigned_order, ''),
    w.assigned_order_id
  FROM workers w
  LEFT JOIN job_orders jo ON jo.id = w.assigned_order_id
  WHERE w.portal_token = p_token AND w.status = 'aktivni';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP FUNCTION IF EXISTS admin_save_form(UUID, DATE, TEXT, work_type, TEXT, TIME, TIME, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB);

CREATE OR REPLACE FUNCTION admin_save_form(
  p_form_id UUID,
  p_form_date DATE,
  p_order_id UUID,
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
  v_order_name TEXT;
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

  IF p_order_id IS NOT NULL THEN
    SELECT name INTO v_order_name FROM job_orders WHERE id = p_order_id;
  END IF;
  IF v_order_name IS NULL THEN
    SELECT order_name INTO v_order_name FROM worker_daily_forms WHERE id = p_form_id;
  END IF;

  v_hours := calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0));

  UPDATE worker_daily_forms SET
    form_date = p_form_date,
    order_id = p_order_id,
    order_name = COALESCE(v_order_name, ''),
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
    order_id = p_order_id,
    order_name = COALESCE(v_order_name, ''),
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
    order_id = p_order_id,
    order_name = COALESCE(v_order_name, ''),
    hours = v_hours,
    work_start = p_work_start,
    work_end = p_work_end,
    break_minutes = COALESCE(p_break_minutes, 0)
  WHERE form_id = p_form_id;

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
    worker_id, form_id, attendance_date, order_id, order_name, hours, work_start, work_end, break_minutes
  )
  VALUES (
    v_form.worker_id, p_form_id, v_form.form_date, v_form.order_id, v_form.order_name, v_form.hours,
    v_form.work_start, v_form.work_end, COALESCE(v_form.break_minutes, 0)
  )
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET
    hours = EXCLUDED.hours,
    form_id = EXCLUDED.form_id,
    order_id = EXCLUDED.order_id,
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
    'order_id', v_form.order_id,
    'order_name', v_form.order_name,
    'form_date', v_form.form_date,
    'earnings', v_earnings,
    'advance', v_form.advance,
    'hours', v_form.hours
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_job_order_detail(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF get_user_role() NOT IN ('administrator', 'vedouci') THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT jsonb_build_object(
    'order', to_jsonb(jo.*),
    'documents', COALESCE((
      SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at DESC)
      FROM job_order_documents d WHERE d.order_id = jo.id
    ), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at DESC)
      FROM job_order_photos p WHERE p.order_id = jo.id
    ), '[]'::jsonb),
    'employees', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object(
        'id', w.id,
        'first_name', w.first_name,
        'last_name', w.last_name,
        'position', w."position"
      ))
      FROM workers w
      WHERE w.assigned_order_id = jo.id
         OR w.id IN (SELECT DISTINCT f.worker_id FROM worker_daily_forms f WHERE f.order_id = jo.id)
    ), '[]'::jsonb),
    'attendance', COALESCE((
      SELECT jsonb_agg(to_jsonb(a.*) ORDER BY a.attendance_date DESC)
      FROM worker_attendance_records a WHERE a.order_id = jo.id
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(to_jsonb(r.*) ORDER BY r.report_date DESC)
      FROM worker_reports r WHERE r.order_id = jo.id
    ), '[]'::jsonb),
    'advances', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'form_date', f.form_date,
        'worker_id', f.worker_id,
        'worker_name', w.first_name || ' ' || w.last_name,
        'advance', f.advance,
        'earnings', f.earnings
      ) ORDER BY f.form_date DESC)
      FROM worker_daily_forms f
      JOIN workers w ON w.id = f.worker_id
      WHERE f.order_id = jo.id AND f.advance > 0
        AND f.status IN ('odeslany', 'schvaleny')
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM job_orders jo
  WHERE jo.id = p_order_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Zakázka nenalezena';
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION portal_get_active_orders(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_job_order_detail(UUID) TO authenticated;

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id = 'zakazky';

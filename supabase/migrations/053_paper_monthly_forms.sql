-- Modul: Papírové měsíční výkazy
-- Zakázky po dnech a po řádcích, import přes QR + AI, commit přes existující admin_upsert_attendance

ALTER TABLE job_orders
  ADD COLUMN IF NOT EXISTS short_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_orders_short_code
  ON job_orders (short_code)
  WHERE short_code IS NOT NULL;

DO $$ BEGIN
  CREATE TYPE paper_form_status AS ENUM (
    'draft', 'assigned', 'printed', 'imported', 'review', 'approved', 'rejected', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE paper_form_line_role AS ENUM (
    'attendance_primary', 'performance', 'performance_continuation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS paper_monthly_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  form_number TEXT NOT NULL UNIQUE,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL CHECK (year >= 2020),
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status paper_form_status NOT NULL DEFAULT 'draft',
  worker_snapshot JSONB,
  order_legend JSONB NOT NULL DEFAULT '[]'::jsonb,
  blank_pdf_path TEXT,
  scanned_photo_path TEXT,
  signed_pdf_path TEXT,
  ai_raw_response JSONB,
  ai_confidence NUMERIC(5, 2),
  ai_model TEXT,
  ai_processed_at TIMESTAMPTZ,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_paper_forms_status ON paper_monthly_forms(status);
CREATE INDEX IF NOT EXISTS idx_paper_forms_period ON paper_monthly_forms(year, month);
CREATE INDEX IF NOT EXISTS idx_paper_forms_worker ON paper_monthly_forms(worker_id);

CREATE TABLE IF NOT EXISTS paper_monthly_form_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_form_id UUID NOT NULL REFERENCES paper_monthly_forms(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  source_section TEXT NOT NULL DEFAULT 'main_table',
  form_date DATE NOT NULL,
  line_role paper_form_line_role NOT NULL DEFAULT 'performance',
  work_start TIME,
  work_end TIME,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  attendance_status attendance_status DEFAULT 'pritomen',
  order_code TEXT,
  order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL,
  order_name_resolved TEXT,
  price_item_id UUID REFERENCES worker_price_items(id) ON DELETE SET NULL,
  work_type_text TEXT,
  quantity NUMERIC(12, 2),
  unit TEXT,
  performance_hours NUMERIC(8, 2),
  material TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  worker_daily_form_id UUID REFERENCES worker_daily_forms(id) ON DELETE SET NULL,
  ai_confidence NUMERIC(5, 2),
  ai_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (paper_form_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_paper_form_lines_form ON paper_monthly_form_lines(paper_form_id);
CREATE INDEX IF NOT EXISTS idx_paper_form_lines_date ON paper_monthly_form_lines(form_date);

CREATE TABLE IF NOT EXISTS paper_monthly_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_form_id UUID NOT NULL REFERENCES paper_monthly_forms(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER paper_monthly_forms_updated_at
  BEFORE UPDATE ON paper_monthly_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE paper_monthly_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_monthly_form_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_monthly_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte papírové formuláře"
  ON paper_monthly_forms FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje papírové formuláře"
  ON paper_monthly_forms FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte řádky papírových formulářů"
  ON paper_monthly_form_lines FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje řádky papírových formulářů"
  ON paper_monthly_form_lines FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte log importu"
  ON paper_monthly_import_log FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin zapisuje log importu"
  ON paper_monthly_import_log FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'paper-forms',
  'paper-forms',
  false,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin nahrává papírové formuláře"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'paper-forms'
    AND get_user_role() = 'administrator'
  );

CREATE POLICY "Admin čte papírové formuláře storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'paper-forms'
    AND get_user_role() = 'administrator'
  );

CREATE POLICY "Admin maže papírové formuláře storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'paper-forms'
    AND get_user_role() = 'administrator'
  );

CREATE OR REPLACE FUNCTION generate_paper_public_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_result TEXT := 'PMF-';
  v_i INTEGER;
  v_try INTEGER := 0;
BEGIN
  LOOP
    v_result := 'PMF-';
    FOR v_i IN 1..8 LOOP
      v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::INTEGER, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM paper_monthly_forms WHERE public_id = v_result);
    v_try := v_try + 1;
    IF v_try > 50 THEN
      RAISE EXCEPTION 'Nelze vygenerovat unikátní public_id';
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION next_paper_form_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM paper_monthly_forms
  WHERE year = p_year;
  RETURN 'PM-' || p_year::TEXT || '-' || lpad(v_seq::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION build_paper_order_legend()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'short_code', short_code,
        'name', name,
        'location', location,
        'order_id', id
      )
      ORDER BY name
    ),
    '[]'::jsonb
  )
  FROM job_orders
  WHERE status = 'aktivni'
    AND short_code IS NOT NULL
    AND btrim(short_code) <> '';
$$;

CREATE OR REPLACE FUNCTION resolve_order_by_short_code(p_code TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM job_orders
  WHERE upper(btrim(short_code)) = upper(btrim(p_code))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION create_paper_monthly_form(
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
  v_public_id TEXT;
  v_form_number TEXT;
  v_days INTEGER;
  v_day INTEGER;
  v_date DATE;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  v_public_id := generate_paper_public_id();
  v_form_number := next_paper_form_number(p_year);
  v_days := EXTRACT(DAY FROM (date_trunc('month', make_date(p_year, p_month, 1)) + INTERVAL '1 month - 1 day'))::INTEGER;

  INSERT INTO paper_monthly_forms (
    public_id, form_number, month, year, supervisor_id, order_legend, created_by, status
  )
  VALUES (
    v_public_id, v_form_number, p_month, p_year, p_supervisor_id,
    build_paper_order_legend(), auth.uid(), 'draft'
  )
  RETURNING id INTO v_id;

  FOR v_day IN 1..v_days LOOP
    v_date := make_date(p_year, p_month, v_day);
    INSERT INTO paper_monthly_form_lines (
      paper_form_id, line_number, source_section, form_date, line_role, sort_order
    )
    VALUES (
      v_id, v_day, 'main_table', v_date, 'attendance_primary', v_day
    );
  END LOOP;

  INSERT INTO paper_monthly_import_log (paper_form_id, action, payload, performed_by)
  VALUES (v_id, 'create', jsonb_build_object('month', p_month, 'year', p_year), auth.uid());

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION assign_paper_monthly_form_worker(
  p_form_id UUID,
  p_worker_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker workers%ROWTYPE;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_worker FROM workers WHERE id = p_worker_id AND status = 'aktivni';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aktivní zaměstnanec nenalezen';
  END IF;

  UPDATE paper_monthly_forms SET
    worker_id = p_worker_id,
    worker_snapshot = jsonb_build_object(
      'first_name', v_worker.first_name,
      'last_name', v_worker.last_name,
      'address', v_worker.address,
      'birth_date', v_worker.birth_date,
      'start_date', v_worker.start_date,
      'position', v_worker."position",
      'employment_type', v_worker.employment_type,
      'phone', v_worker.phone,
      'birth_number', v_worker.birth_number
    ),
    status = CASE WHEN status = 'draft' THEN 'assigned'::paper_form_status ELSE status END,
    updated_at = now()
  WHERE id = p_form_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulář nenalezen';
  END IF;

  INSERT INTO paper_monthly_import_log (paper_form_id, action, payload, performed_by)
  VALUES (
    p_form_id, 'assign_worker',
    jsonb_build_object('worker_id', p_worker_id, 'worker_name', v_worker.first_name || ' ' || v_worker.last_name),
    auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION resolve_paper_form_public_id(p_public_id TEXT)
RETURNS TABLE (
  id UUID,
  public_id TEXT,
  form_number TEXT,
  month SMALLINT,
  year SMALLINT,
  worker_id UUID,
  worker_name TEXT,
  status paper_form_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.public_id,
    f.form_number,
    f.month,
    f.year,
    f.worker_id,
    CASE
      WHEN f.worker_snapshot IS NOT NULL THEN
        (f.worker_snapshot->>'last_name') || ' ' || (f.worker_snapshot->>'first_name')
      ELSE NULL
    END,
    f.status
  FROM paper_monthly_forms f
  WHERE upper(btrim(f.public_id)) = upper(btrim(p_public_id));
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
    updated_at = now()
  WHERE id = p_form_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulář nenalezen';
  END IF;
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
    IF COALESCE(v_line->>'line_role', '') = 'attendance_primary' THEN
      UPDATE paper_monthly_form_lines SET
        work_start = NULLIF(v_line->>'work_start', '')::TIME,
        work_end = NULLIF(v_line->>'work_end', '')::TIME,
        break_minutes = COALESCE((v_line->>'break_minutes')::INTEGER, 0),
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
        performance_hours, material, note, ai_confidence, ai_flags, sort_order
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

CREATE OR REPLACE FUNCTION consolidate_daily_attendance(
  p_worker_id UUID,
  p_date DATE,
  p_work_start TIME,
  p_work_end TIME,
  p_break_minutes INTEGER,
  p_status attendance_status DEFAULT 'pritomen'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours NUMERIC(8, 2);
BEGIN
  v_hours := COALESCE(calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0)), 0);

  UPDATE worker_attendance_records SET
    work_start = COALESCE(p_work_start, work_start),
    work_end = COALESCE(p_work_end, work_end),
    break_minutes = COALESCE(p_break_minutes, break_minutes),
    hours = v_hours,
    attendance_status = COALESCE(p_status, attendance_status)
  WHERE worker_id = p_worker_id AND attendance_date = p_date;
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
  v_grp RECORD;
  v_att RECORD;
  v_task_items JSONB;
  v_form_id UUID;
  v_attendance_id UUID;
  v_is_first BOOLEAN;
  v_created INTEGER := 0;
  v_performer UUID;
  v_default_order UUID;
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
  IF v_form.status NOT IN ('review', 'imported', 'printed') THEN
    RAISE EXCEPTION 'Formulář nelze schválit ve stavu %', v_form.status;
  END IF;

  v_performer := COALESCE(p_performed_by, auth.uid());

  SELECT id INTO v_default_order
  FROM job_orders
  WHERE status = 'aktivni'
  ORDER BY start_date DESC
  LIMIT 1;

  FOR v_grp IN
    SELECT
      l.form_date,
      l.order_id,
      MIN(l.sort_order) AS first_sort
    FROM paper_monthly_form_lines l
    WHERE l.paper_form_id = p_form_id
      AND l.line_role IN ('performance', 'performance_continuation')
      AND l.order_id IS NOT NULL
      AND (
        COALESCE(l.quantity, 0) > 0
        OR COALESCE(l.performance_hours, 0) > 0
        OR l.price_item_id IS NOT NULL
      )
    GROUP BY l.form_date, l.order_id
    ORDER BY l.form_date, MIN(l.sort_order)
  LOOP
    SELECT work_start, work_end, break_minutes, attendance_status
    INTO v_att
    FROM paper_monthly_form_lines
    WHERE paper_form_id = p_form_id
      AND form_date = v_grp.form_date
      AND line_role = 'attendance_primary'
    LIMIT 1;

    SELECT NOT EXISTS (
      SELECT 1 FROM paper_monthly_form_lines
      WHERE paper_form_id = p_form_id
        AND form_date = v_grp.form_date
        AND line_role IN ('performance', 'performance_continuation')
        AND order_id IS NOT NULL
        AND sort_order < v_grp.first_sort
    ) INTO v_is_first;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'price_item_id', l.price_item_id,
        'quantity', COALESCE(NULLIF(l.quantity, 0), l.performance_hours, 0)
      )
    ) FILTER (
      WHERE l.price_item_id IS NOT NULL
        AND COALESCE(NULLIF(l.quantity, 0), l.performance_hours, 0) > 0
    ), '[]'::jsonb)
    INTO v_task_items
    FROM paper_monthly_form_lines l
    WHERE l.paper_form_id = p_form_id
      AND l.form_date = v_grp.form_date
      AND l.order_id = v_grp.order_id
      AND l.line_role IN ('performance', 'performance_continuation');

    IF jsonb_array_length(v_task_items) = 0 THEN
      CONTINUE;
    END IF;

    v_attendance_id := admin_upsert_attendance(
      v_form.worker_id,
      v_grp.form_date,
      v_grp.order_id,
      0,
      '',
      v_task_items,
      CASE WHEN v_is_first THEN v_att.work_start ELSE NULL END,
      CASE WHEN v_is_first THEN v_att.work_end ELSE NULL END,
      CASE WHEN v_is_first THEN COALESCE(v_att.break_minutes, 0) ELSE 0 END,
      NULL,
      v_performer,
      COALESCE(v_att.attendance_status, 'pritomen')
    );

    SELECT form_id INTO v_form_id
    FROM worker_attendance_records
    WHERE id = v_attendance_id;

    UPDATE paper_monthly_form_lines SET worker_daily_form_id = v_form_id
    WHERE paper_form_id = p_form_id
      AND form_date = v_grp.form_date
      AND order_id = v_grp.order_id
      AND line_role IN ('performance', 'performance_continuation');

    v_created := v_created + 1;

    IF v_is_first THEN
      PERFORM consolidate_daily_attendance(
        v_form.worker_id,
        v_grp.form_date,
        v_att.work_start,
        v_att.work_end,
        COALESCE(v_att.break_minutes, 0),
        COALESCE(v_att.attendance_status, 'pritomen')
      );
    END IF;
  END LOOP;

  FOR v_att IN
    SELECT form_date, work_start, work_end, break_minutes, attendance_status
    FROM paper_monthly_form_lines
    WHERE paper_form_id = p_form_id
      AND line_role = 'attendance_primary'
      AND attendance_status IS DISTINCT FROM 'pritomen'
      AND NOT EXISTS (
        SELECT 1 FROM paper_monthly_form_lines p
        WHERE p.paper_form_id = p_form_id
          AND p.form_date = paper_monthly_form_lines.form_date
          AND p.line_role IN ('performance', 'performance_continuation')
          AND p.order_id IS NOT NULL
      )
  LOOP
    IF v_default_order IS NULL THEN
      RAISE EXCEPTION 'Pro dny bez výkonu je potřeba alespoň jedna aktivní zakázka';
    END IF;

    v_attendance_id := admin_upsert_attendance(
      v_form.worker_id,
      v_att.form_date,
      v_default_order,
      0,
      '',
      '[]'::jsonb,
      v_att.work_start,
      v_att.work_end,
      COALESCE(v_att.break_minutes, 0),
      NULL,
      v_performer,
      v_att.attendance_status
    );
    v_created := v_created + 1;
  END LOOP;

  UPDATE paper_monthly_forms SET
    status = 'approved',
    approved_by = v_performer,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_form_id;

  INSERT INTO paper_monthly_import_log (paper_form_id, action, payload, performed_by)
  VALUES (
    p_form_id, 'commit',
    jsonb_build_object('created_forms', v_created),
    v_performer
  );

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (
    v_form.worker_id,
    'Papírový měsíční výkaz importován',
    jsonb_build_object(
      'paper_form_id', p_form_id,
      'form_number', v_form.form_number,
      'month', v_form.month,
      'year', v_form.year,
      'created_forms', v_created
    ),
    v_performer
  );

  RETURN jsonb_build_object('created_forms', v_created, 'paper_form_id', p_form_id);
END;
$$;

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES (
  'papierove-vykazy',
  'Papírové měsíční výkazy',
  '/vykazy/papierove',
  'FileStack',
  6,
  true,
  '1.0.0'
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  is_implemented = true,
  module_version = EXCLUDED.module_version;

GRANT EXECUTE ON FUNCTION create_paper_monthly_form(SMALLINT, SMALLINT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_paper_monthly_form_worker(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_paper_form_public_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_paper_form_printed(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_paper_form_ai_import(UUID, JSONB, JSONB, JSONB, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION commit_paper_monthly_form(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION build_paper_order_legend() TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_order_by_short_code(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

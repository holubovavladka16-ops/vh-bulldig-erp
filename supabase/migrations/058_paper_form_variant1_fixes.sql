-- Varianta 1 papírových měsíčních výkazů: snapshot, duplicity při přiřazení, náhradní formulář

CREATE OR REPLACE FUNCTION build_paper_worker_snapshot(p_worker workers)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'first_name', p_worker.first_name,
    'last_name', p_worker.last_name,
    'address', COALESCE(p_worker.address, ''),
    'birth_date', CASE
      WHEN p_worker.birth_date IS NOT NULL THEN to_char(p_worker.birth_date, 'DD.MM.YYYY')
      ELSE ''
    END,
    'start_date', CASE
      WHEN p_worker.start_date IS NOT NULL THEN to_char(p_worker.start_date, 'DD.MM.YYYY')
      ELSE ''
    END,
    'position', COALESCE(p_worker."position", ''),
    'employment_type', CASE p_worker.employment_type
      WHEN 'HPP' THEN 'HPP'
      WHEN 'DPP' THEN 'DPP'
      WHEN 'DPC' THEN 'DPČ'
      WHEN 'ICO' THEN 'IČO'
      ELSE COALESCE(p_worker.employment_type::text, '')
    END,
    'phone', p_worker.phone,
    'birth_number', p_worker.birth_number
  );
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
  v_form paper_monthly_forms%ROWTYPE;
  v_existing UUID;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_form FROM paper_monthly_forms WHERE id = p_form_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulář nenalezen';
  END IF;

  SELECT * INTO v_worker FROM workers WHERE id = p_worker_id AND status = 'aktivni';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aktivní zaměstnanec nenalezen';
  END IF;

  SELECT f.id INTO v_existing
  FROM paper_monthly_forms f
  WHERE f.worker_id = p_worker_id
    AND f.month = v_form.month
    AND f.year = v_form.year
    AND f.id <> p_form_id
    AND f.status NOT IN ('archived', 'rejected')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_FORM:%', v_existing;
  END IF;

  UPDATE paper_monthly_forms SET
    worker_id = p_worker_id,
    worker_snapshot = build_paper_worker_snapshot(v_worker),
    status = CASE WHEN status = 'draft' THEN 'assigned'::paper_form_status ELSE status END,
    updated_at = now()
  WHERE id = p_form_id;

  INSERT INTO paper_monthly_import_log (paper_form_id, action, payload, performed_by)
  VALUES (
    p_form_id, 'assign_worker',
    jsonb_build_object('worker_id', p_worker_id, 'worker_name', v_worker.first_name || ' ' || v_worker.last_name),
    auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION create_paper_monthly_replacement_form(
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
    PERFORM cancel_paper_monthly_form(v_existing, 'Nahrazeno novým formulářem');
  END IF;

  v_id := create_paper_monthly_form(p_month, p_year, p_supervisor_id);
  PERFORM assign_paper_monthly_form_worker(v_id, p_worker_id);
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION build_paper_worker_snapshot(workers) TO authenticated;
GRANT EXECUTE ON FUNCTION create_paper_monthly_replacement_form(UUID, SMALLINT, SMALLINT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Náhradní papírové formuláře: propojení s původním, stav „nahrazený“

ALTER TYPE paper_form_status ADD VALUE IF NOT EXISTS 'replaced';

ALTER TABLE paper_monthly_forms
  ADD COLUMN IF NOT EXISTS replaces_form_id UUID REFERENCES paper_monthly_forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_by_form_id UUID REFERENCES paper_monthly_forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_paper_forms_one_active_per_worker_month;

CREATE UNIQUE INDEX idx_paper_forms_one_active_per_worker_month
  ON paper_monthly_forms (worker_id, month, year)
  WHERE worker_id IS NOT NULL
    AND status NOT IN ('archived', 'rejected', 'replaced');

CREATE OR REPLACE FUNCTION get_worker_active_paper_form(
  p_worker_id UUID,
  p_month SMALLINT,
  p_year SMALLINT
)
RETURNS TABLE (
  id UUID,
  form_number TEXT,
  public_id TEXT,
  status paper_form_status,
  printed_at TIMESTAMPTZ,
  month SMALLINT,
  year SMALLINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.form_number, f.public_id, f.status, f.printed_at, f.month, f.year
  FROM paper_monthly_forms f
  WHERE f.worker_id = p_worker_id
    AND f.month = p_month
    AND f.year = p_year
    AND f.status NOT IN ('archived', 'rejected', 'replaced')
  ORDER BY f.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION create_paper_monthly_form_for_worker(
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
    AND f.status NOT IN ('archived', 'rejected', 'replaced')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_ACTIVE_FORM:%', v_existing;
  END IF;

  v_id := create_paper_monthly_form(p_month, p_year, p_supervisor_id);
  PERFORM assign_paper_monthly_form_worker(v_id, p_worker_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_paper_monthly_form_replacement(
  p_original_form_id UUID,
  p_supervisor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original paper_monthly_forms%ROWTYPE;
  v_new_id UUID;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_original
  FROM paper_monthly_forms
  WHERE id = p_original_form_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Původní formulář nenalezen';
  END IF;

  IF v_original.worker_id IS NULL THEN
    RAISE EXCEPTION 'Původní formulář nemá přiřazeného zaměstnance';
  END IF;

  IF v_original.status IN ('archived', 'rejected', 'replaced') THEN
    RAISE EXCEPTION 'Původní formulář nelze nahradit v aktuálním stavu';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM paper_monthly_forms f
    WHERE f.worker_id = v_original.worker_id
      AND f.month = v_original.month
      AND f.year = v_original.year
      AND f.status NOT IN ('archived', 'rejected', 'replaced')
      AND f.id <> p_original_form_id
  ) THEN
    RAISE EXCEPTION 'Pro zaměstnance již existuje jiný aktivní formulář za dané období';
  END IF;

  v_new_id := create_paper_monthly_form(v_original.month, v_original.year, p_supervisor_id);
  PERFORM assign_paper_monthly_form_worker(v_new_id, v_original.worker_id);

  UPDATE paper_monthly_forms SET
    status = 'replaced',
    replaced_by_form_id = v_new_id,
    replaced_at = now(),
    updated_at = now()
  WHERE id = p_original_form_id;

  UPDATE paper_monthly_forms SET
    replaces_form_id = p_original_form_id,
    updated_at = now()
  WHERE id = v_new_id;

  INSERT INTO paper_monthly_import_log (paper_form_id, action, payload, performed_by)
  VALUES (
    v_new_id,
    'replacement_create',
    jsonb_build_object('replaces_form_id', p_original_form_id, 'original_form_number', v_original.form_number),
    auth.uid()
  );

  INSERT INTO paper_monthly_import_log (paper_form_id, action, payload, performed_by)
  VALUES (
    p_original_form_id,
    'replaced',
    jsonb_build_object('replaced_by_form_id', v_new_id),
    auth.uid()
  );

  RETURN v_new_id;
END;
$$;

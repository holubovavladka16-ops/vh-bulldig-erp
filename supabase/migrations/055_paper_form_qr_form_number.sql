-- QR resolve podle form_number (PM-2026-000154) i public_id (PMF-...)

CREATE OR REPLACE FUNCTION resolve_paper_form_public_id(p_public_id TEXT)
RETURNS TABLE (
  id UUID,
  public_id TEXT,
  form_number TEXT,
  month SMALLINT,
  year SMALLINT,
  worker_id UUID,
  worker_name TEXT,
  status paper_form_status,
  needs_worker_assignment BOOLEAN
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
    f.status,
    (f.worker_id IS NULL) AS needs_worker_assignment
  FROM paper_monthly_forms f
  WHERE upper(btrim(f.public_id)) = upper(btrim(p_public_id))
     OR upper(btrim(f.form_number)) = upper(btrim(p_public_id));
END;
$$;

NOTIFY pgrst, 'reload schema';

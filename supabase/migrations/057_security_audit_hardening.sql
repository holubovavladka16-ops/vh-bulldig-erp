-- Bezpečnostní hardening po auditu 2026-07-16
-- Obnovení admin kontroly u citlivých RPC, idempotence paper commit

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
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Přístup pouze pro administrátora';
  END IF;

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
$$;

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  RETURN QUERY
  SELECT f.id, f.form_number, f.public_id, f.status, f.printed_at, f.month, f.year
  FROM paper_monthly_forms f
  WHERE f.worker_id = p_worker_id
    AND f.month = p_month
    AND f.year = p_year
    AND f.status NOT IN ('archived', 'rejected')
  ORDER BY f.created_at DESC
  LIMIT 1;
END;
$$;

-- Interní pipeline – nepovolit přímé volání z klienta
REVOKE EXECUTE ON FUNCTION sync_form_downstream(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION recalculate_worker_statistics(UUID, DATE) FROM authenticated;

NOTIFY pgrst, 'reload schema';

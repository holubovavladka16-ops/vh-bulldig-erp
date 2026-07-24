-- Modul 12 – Výplatní pásky
-- Spusťte po 015_module11_pripojky.sql
-- Výplatní pásky vycházejí ze schválených worker_reports (bez duplicitních dat)

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES ('vyplatni-pasky', 'Výplatní pásky', '/vyplatni-pasky', 'Wallet', 6, true, '1.0.0')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  is_implemented = true,
  module_version = EXCLUDED.module_version;

COMMENT ON TABLE payroll IS 'Zastaralé – nepoužívat. Výplatní pásky generuje modul vyplatni-pasky ze schválených výkazů (worker_reports).';

-- Přehled výplat – pouze administrátor (agregace ze schválených výkazů)
CREATE OR REPLACE FUNCTION get_payroll_slip_summaries(
  p_date_from DATE,
  p_date_to DATE,
  p_worker_id UUID DEFAULT NULL
)
RETURNS TABLE (
  worker_id UUID,
  worker_first_name TEXT,
  worker_last_name TEXT,
  report_count BIGINT,
  total_earnings NUMERIC,
  total_advances NUMERIC,
  net_amount NUMERIC
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
    w.id AS worker_id,
    w.first_name AS worker_first_name,
    w.last_name AS worker_last_name,
    COUNT(r.id) AS report_count,
    COALESCE(SUM(r.earnings), 0) AS total_earnings,
    COALESCE(SUM(r.advance), 0) AS total_advances,
    COALESCE(SUM(r.earnings), 0) - COALESCE(SUM(r.advance), 0) AS net_amount
  FROM workers w
  INNER JOIN worker_reports r ON r.worker_id = w.id
  WHERE r.status = 'schvaleny'
    AND r.report_date >= p_date_from
    AND r.report_date <= p_date_to
    AND (p_worker_id IS NULL OR w.id = p_worker_id)
  GROUP BY w.id, w.first_name, w.last_name
  HAVING COUNT(r.id) > 0
  ORDER BY w.last_name, w.first_name;
END;
$$;

REVOKE ALL ON FUNCTION get_payroll_slip_summaries(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_payroll_slip_summaries(DATE, DATE, UUID) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_worker_reports_payroll
  ON worker_reports(worker_id, report_date DESC)
  WHERE status = 'schvaleny';

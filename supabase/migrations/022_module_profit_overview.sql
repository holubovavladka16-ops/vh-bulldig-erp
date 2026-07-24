-- Modul – Přehled hospodaření a zisku
-- Spusťte po 021_workers_admin_write_rls.sql

CREATE TYPE job_cost_category AS ENUM (
  'material',
  'naradi',
  'pujcovna',
  'ubytovani',
  'phm',
  'jizdenky',
  'ostatni'
);

ALTER TABLE job_costs
  ADD COLUMN IF NOT EXISTS category job_cost_category NOT NULL DEFAULT 'ostatni';

CREATE INDEX IF NOT EXISTS idx_job_costs_category ON job_costs(category);

CREATE TABLE IF NOT EXISTS job_order_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  invoice_number TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_order_invoices_order ON job_order_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_job_order_invoices_date ON job_order_invoices(invoice_date);

ALTER TABLE job_order_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte fakturaci zakázek"
  ON job_order_invoices FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje fakturaci zakázek"
  ON job_order_invoices FOR ALL
  USING (get_user_role() = 'administrator');

CREATE OR REPLACE FUNCTION get_profit_overview(
  p_order_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  order_name TEXT,
  period_from DATE,
  period_to DATE,
  invoiced_amount NUMERIC,
  labor_costs NUMERIC,
  employee_advances NUMERIC,
  material_costs NUMERIC,
  tools_costs NUMERIC,
  rental_costs NUMERIC,
  accommodation_costs NUMERIC,
  fuel_costs NUMERIC,
  tickets_costs NUMERIC,
  other_costs NUMERIC,
  total_costs NUMERIC,
  net_profit NUMERIC,
  profit_margin NUMERIC
) AS $$
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  RETURN QUERY
  WITH orders_scope AS (
    SELECT jo.id, jo.name, jo.start_date, jo.end_date
    FROM job_orders jo
    WHERE p_order_id IS NULL OR jo.id = p_order_id
  ),
  periods AS (
    SELECT
      o.id,
      o.name,
      COALESCE(p_date_from, o.start_date) AS period_from,
      COALESCE(p_date_to, LEAST(o.end_date, CURRENT_DATE)) AS period_to
    FROM orders_scope o
  ),
  aggregated AS (
    SELECT
      p.id,
      p.name,
      p.period_from,
      p.period_to,
      COALESCE((
        SELECT SUM(joi.amount)
        FROM job_order_invoices joi
        WHERE joi.order_id = p.id
          AND joi.invoice_date BETWEEN p.period_from AND p.period_to
      ), 0) AS invoiced_amount,
      COALESCE((
        SELECT SUM(r.earnings)
        FROM worker_reports r
        WHERE r.order_id = p.id
          AND r.status = 'schvaleny'
          AND r.report_date BETWEEN p.period_from AND p.period_to
      ), 0) AS labor_costs,
      COALESCE((
        SELECT SUM(r.advance)
        FROM worker_reports r
        WHERE r.order_id = p.id
          AND r.status = 'schvaleny'
          AND r.report_date BETWEEN p.period_from AND p.period_to
      ), 0) AS employee_advances,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'material'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS material_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'naradi'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS tools_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'pujcovna'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS rental_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'ubytovani'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS accommodation_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'phm'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS fuel_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'jizdenky'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS tickets_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'ostatni'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) + COALESCE((
        SELECT SUM(rec.amount)
        FROM receipts rec
        WHERE rec.order_id = p.id
          AND rec.receipt_date BETWEEN p.period_from AND p.period_to
          AND rec.amount IS NOT NULL
      ), 0) AS other_costs
    FROM periods p
  )
  SELECT
    a.id AS order_id,
    a.name AS order_name,
    a.period_from,
    a.period_to,
    a.invoiced_amount,
    a.labor_costs,
    a.employee_advances,
    a.material_costs,
    a.tools_costs,
    a.rental_costs,
    a.accommodation_costs,
    a.fuel_costs,
    a.tickets_costs,
    a.other_costs,
    (
      a.labor_costs + a.employee_advances + a.material_costs + a.tools_costs +
      a.rental_costs + a.accommodation_costs + a.fuel_costs + a.tickets_costs + a.other_costs
    ) AS total_costs,
    a.invoiced_amount - (
      a.labor_costs + a.employee_advances + a.material_costs + a.tools_costs +
      a.rental_costs + a.accommodation_costs + a.fuel_costs + a.tickets_costs + a.other_costs
    ) AS net_profit,
    CASE
      WHEN a.invoiced_amount > 0 THEN ROUND(
        (
          (a.invoiced_amount - (
            a.labor_costs + a.employee_advances + a.material_costs + a.tools_costs +
            a.rental_costs + a.accommodation_costs + a.fuel_costs + a.tickets_costs + a.other_costs
          )) / a.invoiced_amount
        ) * 100,
        2
      )
      ELSE NULL
    END AS profit_margin
  FROM aggregated a
  ORDER BY a.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_profit_overview(UUID, DATE, DATE) TO authenticated;

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id = 'denni-formulare';

UPDATE erp_modules
SET
  is_implemented = true,
  module_version = '1.0.0',
  label = 'Přehled hospodaření a zisku'
WHERE id = 'statistiky';

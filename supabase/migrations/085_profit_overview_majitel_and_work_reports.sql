-- Migrace 085 – Rozšíření get_profit_overview() o roli Majitel a Fakturační výkaz prací
-- Spusťte po 084_invoiceable_work_reports_module.sql
--
-- Samostatná, výslovně schválená úprava existující funkce:
-- 1) Podmínka `get_user_role() <> 'administrator'` se mění na
--    `get_user_role() NOT IN ('administrator', 'majitel')`, aby Majitel
--    mohl Hospodaření a zisk skutečně číst (dnes funkce Majitele aktivně
--    odmítá vyjímkou, bez ohledu na frontendová oprávnění).
-- 2) Přidán nový vrácený sloupec `predicted_work_report_amount` – součet
--    z `invoiceable_work_report_order_totals` (Fakturační výkaz prací).
--    Žádný stávající sloupec se nepřepočítává ani neodstraňuje.
--
-- Tabulka job_order_invoices, worker_reports, job_costs, receipts – beze změny.
-- Fakturovač – nedotčeno.

DROP FUNCTION IF EXISTS get_profit_overview(UUID, DATE, DATE);

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
  predicted_work_report_amount NUMERIC,
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
  IF get_user_role() NOT IN ('administrator', 'majitel') THEN
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
        SELECT SUM(t.total_amount)
        FROM invoiceable_work_report_order_totals t
        WHERE t.order_id = p.id
          AND t.closed_at::date BETWEEN p.period_from AND p.period_to
      ), 0) AS predicted_work_report_amount,
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
    a.predicted_work_report_amount,
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

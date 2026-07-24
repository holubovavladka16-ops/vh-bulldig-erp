-- Migrace 084 – Modul Fakturační výkaz prací
-- Spusťte po 083_daily_calendar_module.sql
--
-- Rozhodnutí potvrzená zadavatelem:
-- 1) Každý řádek výkazu má vlastní order_id, jeden výkaz může obsahovat více zakázek.
-- 2) Cena se při uložení řádku ukládá jako pevná (snapshot) hodnota, nikdy se zpětně nepřepočítá.
-- 3) Uzavřený výkaz nelze běžně upravovat – vynuceno DB triggerem.
-- 4) Znovuotevřít smí pouze administrator nebo majitel.
-- 5) Do Hospodaření a zisku se předává pouze hotový součet za zakázku (samostatná tabulka),
--    nikdy jednotlivé řádky.
-- 6) Zapamatovaná cena na zakázce se aktualizuje při každém uložení i úpravě rozpracovaného řádku.
-- 7) Fakturovač (src/lib/invoices/*) zůstává zcela beze změny – žádná vazba tímto směrem.

-- ----------------------------------------------------------------------------
-- 1. Enumerační typ
-- ----------------------------------------------------------------------------

CREATE TYPE invoiceable_report_status AS ENUM ('rozpracovany', 'uzavreny');

-- ----------------------------------------------------------------------------
-- 2. Hlavní fakturační výkaz
-- ----------------------------------------------------------------------------

CREATE TABLE invoiceable_work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  note TEXT,
  customer_name TEXT,
  contract_number TEXT,
  purchase_order_number TEXT,
  status invoiceable_report_status NOT NULL DEFAULT 'rozpracovany',
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iwr_period_valid CHECK (period_to >= period_from)
);

CREATE INDEX idx_iwr_status ON invoiceable_work_reports(status);
CREATE INDEX idx_iwr_period ON invoiceable_work_reports(period_from, period_to);

CREATE TRIGGER trg_iwr_updated_at
  BEFORE UPDATE ON invoiceable_work_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Správa fakturačních položek (ceník)
-- ----------------------------------------------------------------------------

CREATE TABLE invoiceable_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  unit TEXT NOT NULL,
  price_from NUMERIC(12,2) NOT NULL CHECK (price_from >= 0),
  price_to NUMERIC(12,2) NOT NULL CHECK (price_to >= price_from),
  price_step NUMERIC(12,2) NOT NULL CHECK (price_step > 0),
  default_price NUMERIC(12,2) NOT NULL,
  allow_custom_price BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iwi_default_price_range CHECK (default_price BETWEEN price_from AND price_to)
);

CREATE INDEX idx_iwi_active ON invoiceable_items(is_active);

CREATE TRIGGER trg_iwi_updated_at
  BEFORE UPDATE ON invoiceable_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Řádky výkazu (každý řádek má vlastní zakázku)
-- ----------------------------------------------------------------------------

CREATE TABLE invoiceable_work_report_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES invoiceable_work_reports(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  work_date DATE NOT NULL,
  item_id UUID REFERENCES invoiceable_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_category TEXT,
  unit TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_iwrl_report ON invoiceable_work_report_lines(report_id);
CREATE INDEX idx_iwrl_order ON invoiceable_work_report_lines(order_id);
CREATE INDEX idx_iwrl_date ON invoiceable_work_report_lines(work_date);

-- ----------------------------------------------------------------------------
-- 5. Zapamatovaná poslední cena na kombinaci zakázka + položka
-- ----------------------------------------------------------------------------

CREATE TABLE invoiceable_order_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES invoiceable_items(id) ON DELETE CASCADE,
  last_unit_price NUMERIC(12,2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iwoip_unique UNIQUE (order_id, item_id)
);

-- ----------------------------------------------------------------------------
-- 6. Historie změn
-- ----------------------------------------------------------------------------

CREATE TABLE invoiceable_work_report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES invoiceable_work_reports(id) ON DELETE CASCADE,
  line_id UUID REFERENCES invoiceable_work_report_lines(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB
);

CREATE INDEX idx_iwrh_report ON invoiceable_work_report_history(report_id);

-- ----------------------------------------------------------------------------
-- 7. Samostatná tabulka pro předání součtu do Hospodaření a zisku
-- ----------------------------------------------------------------------------

CREATE TABLE invoiceable_work_report_order_totals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES invoiceable_work_reports(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  total_amount NUMERIC(12,2) NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT iwrot_unique UNIQUE (report_id, order_id)
);

CREATE INDEX idx_iwrot_order ON invoiceable_work_report_order_totals(order_id);

-- ----------------------------------------------------------------------------
-- 8. Triggery – automatický přepočet, zapamatování ceny, ochrana uzavřeného výkazu
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION iwrl_set_line_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.line_total := ROUND(NEW.quantity * NEW.unit_price, 2);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_iwrl_set_line_total
  BEFORE INSERT OR UPDATE ON invoiceable_work_report_lines
  FOR EACH ROW EXECUTE FUNCTION iwrl_set_line_total();

-- Zapamatovaná cena se aktualizuje při KAŽDÉM uložení i úpravě rozpracovaného řádku
-- (potvrzeno zadavatelem) – proto AFTER INSERT OR UPDATE, ne jen INSERT.
CREATE OR REPLACE FUNCTION iwrl_remember_order_price()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_id IS NOT NULL THEN
    INSERT INTO invoiceable_order_item_prices (order_id, item_id, last_unit_price, updated_at)
    VALUES (NEW.order_id, NEW.item_id, NEW.unit_price, now())
    ON CONFLICT (order_id, item_id)
    DO UPDATE SET last_unit_price = EXCLUDED.last_unit_price, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_iwrl_remember_price
  AFTER INSERT OR UPDATE ON invoiceable_work_report_lines
  FOR EACH ROW EXECUTE FUNCTION iwrl_remember_order_price();

-- Zablokování úprav/mazání řádků, pokud je nadřazený výkaz uzavřený
CREATE OR REPLACE FUNCTION iwrl_block_if_report_closed()
RETURNS TRIGGER AS $$
DECLARE
  v_status invoiceable_report_status;
BEGIN
  SELECT status INTO v_status FROM invoiceable_work_reports
  WHERE id = COALESCE(NEW.report_id, OLD.report_id);

  IF v_status = 'uzavreny' THEN
    RAISE EXCEPTION 'Uzavřený výkaz nelze upravovat. Nejprve jej znovu otevřete.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_iwrl_block_closed
  BEFORE UPDATE OR DELETE ON invoiceable_work_report_lines
  FOR EACH ROW EXECUTE FUNCTION iwrl_block_if_report_closed();

-- ----------------------------------------------------------------------------
-- 9. Uzavření a znovuotevření výkazu (jen administrator nebo majitel)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION close_invoiceable_work_report(p_report_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF get_user_role() NOT IN ('administrator', 'majitel') THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  UPDATE invoiceable_work_reports
  SET status = 'uzavreny', closed_at = now(), closed_by = p_user_id
  WHERE id = p_report_id;

  INSERT INTO invoiceable_work_report_order_totals (report_id, order_id, total_amount, closed_at)
  SELECT p_report_id, order_id, SUM(line_total), now()
  FROM invoiceable_work_report_lines
  WHERE report_id = p_report_id
  GROUP BY order_id
  ON CONFLICT (report_id, order_id)
  DO UPDATE SET total_amount = EXCLUDED.total_amount, closed_at = EXCLUDED.closed_at;

  INSERT INTO invoiceable_work_report_history (report_id, action, changed_by)
  VALUES (p_report_id, 'closed', p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reopen_invoiceable_work_report(p_report_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF get_user_role() NOT IN ('administrator', 'majitel') THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  UPDATE invoiceable_work_reports
  SET status = 'rozpracovany', reopened_at = now(), reopened_by = p_user_id
  WHERE id = p_report_id;

  DELETE FROM invoiceable_work_report_order_totals WHERE report_id = p_report_id;

  INSERT INTO invoiceable_work_report_history (report_id, action, changed_by)
  VALUES (p_report_id, 'reopened', p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 10. Row Level Security – pouze administrator a majitel
-- ----------------------------------------------------------------------------

ALTER TABLE invoiceable_work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoiceable_work_report_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoiceable_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoiceable_order_item_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoiceable_work_report_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoiceable_work_report_order_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin a majitel – výkazy" ON invoiceable_work_reports
  FOR ALL USING (get_user_role() IN ('administrator', 'majitel'));

CREATE POLICY "Admin a majitel – řádky výkazu" ON invoiceable_work_report_lines
  FOR ALL USING (get_user_role() IN ('administrator', 'majitel'));

CREATE POLICY "Admin a majitel – ceník položek" ON invoiceable_items
  FOR ALL USING (get_user_role() IN ('administrator', 'majitel'));

CREATE POLICY "Admin a majitel – zapamatované ceny" ON invoiceable_order_item_prices
  FOR ALL USING (get_user_role() IN ('administrator', 'majitel'));

CREATE POLICY "Admin a majitel – historie" ON invoiceable_work_report_history
  FOR SELECT USING (get_user_role() IN ('administrator', 'majitel'));

CREATE POLICY "Admin a majitel – součty pro hospodaření" ON invoiceable_work_report_order_totals
  FOR SELECT USING (get_user_role() IN ('administrator', 'majitel'));

GRANT SELECT, INSERT, UPDATE, DELETE ON invoiceable_work_reports TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoiceable_work_report_lines TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoiceable_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoiceable_order_item_prices TO authenticated, service_role;
GRANT SELECT ON invoiceable_work_report_history TO authenticated, service_role;
GRANT SELECT ON invoiceable_work_report_order_totals TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION close_invoiceable_work_report(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reopen_invoiceable_work_report(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 11. Registrace modulu (stejný vzor jako u ostatních modulů)
-- ----------------------------------------------------------------------------

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES (
  'fakturacni-vykaz',
  'Fakturační výkaz prací',
  '/fakturacni-vykaz',
  'Calculator',
  20,
  true,
  '1.0.0'
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_implemented = true,
  module_version = EXCLUDED.module_version;

NOTIFY pgrst, 'reload schema';

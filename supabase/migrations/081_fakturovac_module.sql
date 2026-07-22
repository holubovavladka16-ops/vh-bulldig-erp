-- Modul Fakturovač VH Bulldig (ERP 8)
-- Spusťte po 080_app_settings_visual_theme.sql

CREATE TYPE issued_invoice_status AS ENUM (
  'koncept',
  'vytvorena',
  'odeslana',
  'zaplacena',
  'storno'
);

CREATE TYPE invoice_payment_method AS ENUM ('bankovni_prevod', 'hotovost');

CREATE TYPE invoice_text_variant AS ENUM ('prace', 'pripravne_prace', 'vlastni');

CREATE TABLE invoice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT '',
  ico TEXT NOT NULL DEFAULT '',
  dic TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  bank_account TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  default_due_days INTEGER NOT NULL DEFAULT 14 CHECK (default_due_days >= 0),
  is_vat_payer BOOLEAN NOT NULL DEFAULT true,
  default_vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 21 CHECK (default_vat_rate >= 0),
  logo_path TEXT,
  signature_path TEXT,
  stamp_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER invoice_settings_updated_at
  BEFORE UPDATE ON invoice_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO invoice_settings (company_name)
VALUES ('VH Bulldig s.r.o.');

CREATE TABLE invoice_number_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  n INTEGER;
BEGIN
  INSERT INTO invoice_number_counters (year, last_number)
  VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = invoice_number_counters.last_number + 1
  RETURNING last_number INTO n;

  RETURN y::TEXT || LPAD(n::TEXT, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION next_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_invoice_number() TO authenticated, service_role;

CREATE TABLE issued_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  variable_symbol TEXT NOT NULL DEFAULT '',
  order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL,
  status issued_invoice_status NOT NULL DEFAULT 'koncept',
  issue_date DATE NOT NULL,
  taxable_date DATE,
  due_date DATE,
  payment_method invoice_payment_method NOT NULL DEFAULT 'bankovni_prevod',
  text_variant invoice_text_variant NOT NULL DEFAULT 'prace',
  custom_text TEXT NOT NULL DEFAULT '',
  vat_mode TEXT NOT NULL DEFAULT '21' CHECK (vat_mode IN ('none', '21', '12', '0')),
  customer_name TEXT NOT NULL DEFAULT '',
  customer_ico TEXT NOT NULL DEFAULT '',
  customer_dic TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  customer_city TEXT NOT NULL DEFAULT '',
  customer_postal_code TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency TEXT NOT NULL DEFAULT 'CZK',
  note TEXT,
  sent_at TIMESTAMPTZ,
  sent_to_email TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_issued_invoices_number ON issued_invoices(invoice_number);
CREATE INDEX idx_issued_invoices_issue_date ON issued_invoices(issue_date DESC);
CREATE INDEX idx_issued_invoices_status ON issued_invoices(status);
CREATE INDEX idx_issued_invoices_order ON issued_invoices(order_id);
CREATE INDEX idx_issued_invoices_customer_ico ON issued_invoices(customer_ico);

CREATE TRIGGER issued_invoices_updated_at
  BEFORE UPDATE ON issued_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE issued_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES issued_invoices(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'ks',
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  vat_rate NUMERIC(5, 2),
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  source_type TEXT CHECK (source_type IN ('manual', 'job_cost', 'worker_report')),
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_issued_invoice_lines_invoice ON issued_invoice_lines(invoice_id, sort_order);

ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte nastavení faktur"
  ON invoice_settings FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje nastavení faktur"
  ON invoice_settings FOR UPDATE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte čítače faktur"
  ON invoice_number_counters FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte faktury"
  ON issued_invoices FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin vkládá faktury"
  ON issued_invoices FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje faktury"
  ON issued_invoices FOR UPDATE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin maže faktury"
  ON issued_invoices FOR DELETE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte položky faktur"
  ON issued_invoice_lines FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin vkládá položky faktur"
  ON issued_invoice_lines FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje položky faktur"
  ON issued_invoice_lines FOR UPDATE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin maže položky faktur"
  ON issued_invoice_lines FOR DELETE
  USING (get_user_role() = 'administrator');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('invoice-assets', 'invoice-assets', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin nahrává podklady faktur"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-assets');

CREATE POLICY "Admin čte podklady faktur"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-assets');

CREATE POLICY "Veřejné čtení podkladů faktur"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'invoice-assets');

CREATE POLICY "Admin maže podklady faktur"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'invoice-assets');

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES ('fakturovac', 'Fakturovač', '/fakturace', 'ScrollText', 9, true, '1.0.0')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  is_implemented = true,
  module_version = EXCLUDED.module_version;

GRANT SELECT, UPDATE ON invoice_settings TO authenticated, service_role;
GRANT SELECT ON invoice_number_counters TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON issued_invoices TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON issued_invoice_lines TO authenticated, service_role;

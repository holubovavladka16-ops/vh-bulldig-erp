-- Modul 12 – Paragony (účtenky pro účetnictví)
-- Spusťte po 018_erp_security_lockdown.sql

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_date DATE NOT NULL,
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  expense_name TEXT NOT NULL,
  amount NUMERIC(12, 2) CHECK (amount IS NULL OR amount >= 0),
  supplier TEXT,
  note TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  captured_date DATE NOT NULL,
  captured_time TIME NOT NULL,
  gps_lat NUMERIC(10, 7),
  gps_lng NUMERIC(10, 7),
  gps_accuracy NUMERIC(10, 2),
  address_full TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipts_date ON receipts(receipt_date DESC);
CREATE INDEX idx_receipts_order ON receipts(order_id);
CREATE INDEX idx_receipts_order_date ON receipts(order_id, receipt_date);

CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte paragony"
  ON receipts FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin vkládá paragony"
  ON receipts FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje paragony"
  ON receipts FOR UPDATE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin maže paragony"
  ON receipts FOR DELETE
  USING (get_user_role() = 'administrator');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('receipt-photos', 'receipt-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin nahrává fotografie paragonů"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipt-photos');

CREATE POLICY "Admin čte fotografie paragonů"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipt-photos');

CREATE POLICY "Veřejné čtení fotografií paragonů"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'receipt-photos');

CREATE POLICY "Admin maže fotografie paragonů"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipt-photos');

-- Registrace modulu 12 – Paragony
INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES ('paragony', 'Paragony', '/paragony', 'Receipt', 8, true, '1.0.0')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  is_implemented = true,
  module_version = EXCLUDED.module_version;

-- E-mail účetní pro odeslání paragonů (volitelné nastavení společnosti)
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS accountant_email TEXT NOT NULL DEFAULT '';

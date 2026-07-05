-- Modul 7 – Náklady
-- Spusťte po 010_module6_zakazky.sql

CREATE TABLE job_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_date DATE NOT NULL,
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  supplier TEXT,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_cost_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_id UUID NOT NULL REFERENCES job_costs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_cost_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_id UUID NOT NULL REFERENCES job_costs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_costs_date ON job_costs(cost_date);
CREATE INDEX idx_job_costs_order ON job_costs(order_id);
CREATE INDEX idx_job_costs_order_date ON job_costs(order_id, cost_date);

CREATE TRIGGER job_costs_updated_at
  BEFORE UPDATE ON job_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE job_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cost_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cost_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte náklady"
  ON job_costs FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje náklady"
  ON job_costs FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte doklady nákladů"
  ON job_cost_documents FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje doklady nákladů"
  ON job_cost_documents FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte fotografie nákladů"
  ON job_cost_photos FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje fotografie nákladů"
  ON job_cost_photos FOR ALL
  USING (get_user_role() = 'administrator');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('cost-photos', 'cost-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('cost-documents', 'cost-documents', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin nahrává fotografie nákladů"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cost-photos');

CREATE POLICY "Veřejné čtení fotografií nákladů"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'cost-photos');

CREATE POLICY "Admin nahrává PDF nákladů"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cost-documents');

CREATE POLICY "Autentizovaní čtou PDF nákladů"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cost-documents');

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id = 'ekonomika';

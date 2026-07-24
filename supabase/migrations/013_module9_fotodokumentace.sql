-- Modul 9 – Fotodokumentace s GPS
-- Spusťte po 012_automaticke_smlouvy.sql

CREATE TABLE gps_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_date DATE NOT NULL,
  captured_time TIME NOT NULL,
  gps_lat NUMERIC(10, 7) NOT NULL,
  gps_lng NUMERIC(10, 7) NOT NULL,
  gps_accuracy NUMERIC(10, 2),
  address_full TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  note TEXT,
  order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL,
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  report_id UUID REFERENCES worker_reports(id) ON DELETE SET NULL,
  diary_entry_id UUID,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gps_photo_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES gps_photos(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gps_photos_captured ON gps_photos(captured_date DESC, captured_time DESC);
CREATE INDEX idx_gps_photos_order ON gps_photos(order_id);
CREATE INDEX idx_gps_photos_worker ON gps_photos(worker_id);
CREATE INDEX idx_gps_photos_report ON gps_photos(report_id);

CREATE TRIGGER gps_photos_updated_at
  BEFORE UPDATE ON gps_photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE gps_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_photo_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ERP uživatelé čtou fotodokumentaci"
  ON gps_photos FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP uživatelé vytváří fotodokumentaci"
  ON gps_photos FOR INSERT
  WITH CHECK (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP uživatelé upravují fotodokumentaci"
  ON gps_photos FOR UPDATE
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "Admin maže fotodokumentaci"
  ON gps_photos FOR DELETE
  USING (get_user_role() = 'administrator');

CREATE POLICY "ERP uživatelé čtou historii fotek"
  ON gps_photo_history FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP uživatelé zapisují historii fotek"
  ON gps_photo_history FOR INSERT
  WITH CHECK (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('gps-photos', 'gps-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autentizovaní nahrávají GPS fotografie"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gps-photos');

CREATE POLICY "Veřejné čtení GPS fotografií"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'gps-photos');

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0', label = 'Fotodokumentace' WHERE id = 'fotky';

-- Modul Fotodokumentace s GPS – rozšíření schématu (nová implementace)
-- Spusťte po 061_form_check_phase5.sql

-- Typ fotografie (vlastní typy administrátora)
CREATE TABLE IF NOT EXISTS gps_photo_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO gps_photo_types (code, label, sort_order) VALUES
  ('stav_pred', 'Stav před zahájením prací', 1),
  ('prubeh', 'Průběh prací', 2),
  ('dokonceno', 'Dokončená práce', 3),
  ('vykop', 'Výkop', 4),
  ('trasa', 'Trasa', 5),
  ('pripojka', 'Přípojka', 6),
  ('chranicka', 'Chránička', 7),
  ('kabel', 'Kabel', 8),
  ('pilir', 'Pilíř', 9),
  ('pruraz', 'Průraz', 10),
  ('dlazba', 'Dlažba', 11),
  ('asfalt', 'Asfalt', 12),
  ('zasyp', 'Zásyp', 13),
  ('hutneni', 'Hutnění', 14),
  ('material', 'Materiál', 15),
  ('zavada', 'Závada', 16),
  ('poskozeni', 'Poškození', 17),
  ('kontrolni', 'Kontrolní fotografie', 18),
  ('investor', 'Fotografie pro investora', 19),
  ('jine', 'Jiné', 99)
ON CONFLICT (code) DO NOTHING;

-- Série fotografií
CREATE TABLE IF NOT EXISTS gps_photo_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER gps_photo_series_updated_at
  BEFORE UPDATE ON gps_photo_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit log
CREATE TABLE IF NOT EXISTS gps_photo_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES gps_photos(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Veřejné sdílené galerie zakázky
CREATE TABLE IF NOT EXISTS gps_photo_public_galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  allow_download BOOLEAN NOT NULL DEFAULT false,
  show_address BOOLEAN NOT NULL DEFAULT true,
  show_gps BOOLEAN NOT NULL DEFAULT false,
  photo_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rozšíření gps_photos
ALTER TABLE gps_photos
  ADD COLUMN IF NOT EXISTS photo_type TEXT,
  ADD COLUMN IF NOT EXISTS gps_status TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'nova',
  ADD COLUMN IF NOT EXISTS sync_status TEXT,
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES gps_photo_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paired_photo_id UUID REFERENCES gps_photos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS original_file_path TEXT,
  ADD COLUMN IF NOT EXISTS watermarked_file_path TEXT,
  ADD COLUMN IF NOT EXISTS map_url TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

-- GPS volitelné (uložení bez GPS)
ALTER TABLE gps_photos ALTER COLUMN gps_lat DROP NOT NULL;
ALTER TABLE gps_photos ALTER COLUMN gps_lng DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gps_photos_type ON gps_photos(photo_type);
CREATE INDEX IF NOT EXISTS idx_gps_photos_approval ON gps_photos(approval_status);
CREATE INDEX IF NOT EXISTS idx_gps_photos_gps_status ON gps_photos(gps_status);
CREATE INDEX IF NOT EXISTS idx_gps_photos_series ON gps_photos(series_id);
CREATE INDEX IF NOT EXISTS idx_gps_photos_deleted ON gps_photos(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gps_photo_audit_photo ON gps_photo_audit_log(photo_id);

ALTER TABLE gps_photo_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_photo_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_photo_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_photo_public_galleries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte typy fotografií"
  ON gps_photo_types FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje typy fotografií"
  ON gps_photo_types FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte série fotografií"
  ON gps_photo_series FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje série fotografií"
  ON gps_photo_series FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte audit fotografií"
  ON gps_photo_audit_log FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin zapisuje audit fotografií"
  ON gps_photo_audit_log FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje veřejné galerie"
  ON gps_photo_public_galleries FOR ALL
  USING (get_user_role() = 'administrator');

UPDATE erp_modules
SET is_implemented = true, module_version = '2.0.0', label = 'Fotodokumentace s GPS'
WHERE id = 'fotky';

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES ('fotky-na-mape', 'Fotky na mapě', '/fotky-na-mape', 'MapPin', 95, true, '2.0.0')
ON CONFLICT (id) DO UPDATE SET
  is_implemented = true,
  module_version = '2.0.0',
  label = EXCLUDED.label;

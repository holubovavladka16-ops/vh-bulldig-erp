-- Modul 13 – Fotodokumentace s GPS (nová implementace od nuly, v1.9.0)
-- Tabulka gps_photos zůstává sdílená s deníkem a přípojkami.

ALTER TABLE gps_photos
  ADD COLUMN IF NOT EXISTS gps_verified BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_status TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

ALTER TABLE gps_photos ALTER COLUMN gps_lat DROP NOT NULL;
ALTER TABLE gps_photos ALTER COLUMN gps_lng DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gps_photos_gps_verified ON gps_photos(gps_verified);
CREATE INDEX IF NOT EXISTS idx_gps_photos_sync_status ON gps_photos(sync_status) WHERE sync_status IS NOT NULL;

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES (
  'fotodokumentace-gps',
  'Fotodokumentace s GPS',
  '/fotodokumentace',
  'Camera',
  9,
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

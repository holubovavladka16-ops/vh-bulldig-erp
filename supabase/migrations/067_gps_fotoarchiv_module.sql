-- Modul GPS Fotoarchiv – profesionální archiv fotografií s GPS (nová implementace, route /gps-fotoarchiv)

ALTER TABLE gps_photos
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS device_info TEXT;

CREATE INDEX IF NOT EXISTS idx_gps_photos_created_by ON gps_photos(created_by);

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES (
  'gps-fotoarchiv',
  'Fotodokumentace s GPS',
  '/gps-fotoarchiv',
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

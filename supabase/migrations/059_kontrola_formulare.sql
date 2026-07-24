-- Modul: Kontrola formuláře (Fáze 1 – QR skenování)

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES (
  'kontrola-formulare',
  'Kontrola formuláře',
  '/kontrola-formulare',
  'ScanLine',
  7,
  true,
  '1.0.0'
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  is_implemented = true,
  module_version = EXCLUDED.module_version;

NOTIFY pgrst, 'reload schema';

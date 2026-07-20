-- Modul Fotodokumentace s GPS byl z aplikace odstraněn (v1.8.2+).
-- Tato migrace odregistruje modul a odstraní objekty, které sloužily pouze tomuto modulu.
-- Tabulka gps_photos zůstává – používají ji deník, přípojky a mapa výkopů.

DROP FUNCTION IF EXISTS get_public_photo_gallery(TEXT);

DROP TABLE IF EXISTS gps_photo_public_galleries CASCADE;
DROP TABLE IF EXISTS gps_photo_audit_log CASCADE;
DROP TABLE IF EXISTS gps_photo_series CASCADE;
DROP TABLE IF EXISTS gps_photo_types CASCADE;

DELETE FROM erp_modules WHERE id = 'fotky-na-mape';

UPDATE erp_modules
SET is_implemented = false,
    module_version = '0.0.0',
    label = 'Fotky (zrušeno)'
WHERE id = 'fotky';

NOTIFY pgrst, 'reload schema';

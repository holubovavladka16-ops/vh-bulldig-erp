-- Modul 13 Fotodokumentace s GPS – definitivně odstraněn z aplikace (v1.9.1+).
-- Tabulka gps_photos zůstává – používají ji deník, přípojky a mapa výkopů.

DELETE FROM erp_modules WHERE id = 'fotodokumentace-gps';

DROP INDEX IF EXISTS idx_gps_photos_gps_verified;
DROP INDEX IF EXISTS idx_gps_photos_sync_status;

ALTER TABLE gps_photos
  DROP COLUMN IF EXISTS gps_verified,
  DROP COLUMN IF EXISTS sync_status,
  DROP COLUMN IF EXISTS district,
  DROP COLUMN IF EXISTS region,
  DROP COLUMN IF EXISTS uploaded_at,
  DROP COLUMN IF EXISTS thumbnail_path;

-- Obnovení NOT NULL pouze pokud žádný řádek nemá NULL (deník vždy ukládá GPS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM gps_photos WHERE gps_lat IS NULL OR gps_lng IS NULL) THEN
    ALTER TABLE gps_photos ALTER COLUMN gps_lat SET NOT NULL;
    ALTER TABLE gps_photos ALTER COLUMN gps_lng SET NOT NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

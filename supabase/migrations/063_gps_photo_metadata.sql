-- GPS metadata pro fotodokumentaci: nullable souřadnice + zdroj a čas získání polohy

ALTER TABLE gps_photos
  ALTER COLUMN gps_lat DROP NOT NULL,
  ALTER COLUMN gps_lng DROP NOT NULL;

ALTER TABLE gps_photos
  ADD COLUMN IF NOT EXISTS gps_obtained_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gps_source TEXT,
  ADD COLUMN IF NOT EXISTS gps_from_cache BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN gps_photos.gps_obtained_at IS 'Čas získání GPS polohy ze zařízení';
COMMENT ON COLUMN gps_photos.gps_source IS 'Zdroj polohy: cache, cached_device, high_accuracy, low_accuracy, unavailable';
COMMENT ON COLUMN gps_photos.gps_from_cache IS 'Zda byla poloha načtena z cache před novým měřením';

CREATE INDEX IF NOT EXISTS idx_gps_photos_captured_at ON gps_photos(captured_at DESC);

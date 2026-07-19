-- Rychlá oprava produkce: spusťte v Supabase Dashboard → SQL Editor
-- Projekt: khhalcjgvqoyskkjlkyg
-- Po spuštění počkejte ~10 s (reload schema cache) a zkuste uložit fotografii znovu.

ALTER TABLE gps_photos
  ADD COLUMN IF NOT EXISTS photo_type TEXT,
  ADD COLUMN IF NOT EXISTS gps_status TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'nova',
  ADD COLUMN IF NOT EXISTS sync_status TEXT,
  ADD COLUMN IF NOT EXISTS series_id UUID,
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

ALTER TABLE gps_photos ALTER COLUMN gps_lat DROP NOT NULL;
ALTER TABLE gps_photos ALTER COLUMN gps_lng DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gps_photos_approval ON gps_photos(approval_status);
CREATE INDEX IF NOT EXISTS idx_gps_photos_gps_status ON gps_photos(gps_status);

NOTIFY pgrst, 'reload schema';

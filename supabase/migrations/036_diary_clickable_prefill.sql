-- Stavební deník: naklikávací pole, předvyplnění z docházky a fotodokumentace

ALTER TABLE construction_diary_entries
  ADD COLUMN IF NOT EXISTS weather_type TEXT,
  ADD COLUMN IF NOT EXISTS temperature_celsius NUMERIC(5, 1),
  ADD COLUMN IF NOT EXISTS site_location TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS material TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS extraordinary_events TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS performances_summary TEXT NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';

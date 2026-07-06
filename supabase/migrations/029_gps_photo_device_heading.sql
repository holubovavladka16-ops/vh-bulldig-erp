-- Orientace telefonu při pořízení fotografie
ALTER TABLE gps_photos
  ADD COLUMN IF NOT EXISTS device_heading NUMERIC(5, 1);

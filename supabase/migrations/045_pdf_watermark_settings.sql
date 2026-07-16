-- Nastavení PDF vodoznaku (průhlednost, velikost, rozostření)
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS watermark_opacity SMALLINT NOT NULL DEFAULT 7
    CHECK (watermark_opacity >= 0 AND watermark_opacity <= 100),
  ADD COLUMN IF NOT EXISTS watermark_size_mm NUMERIC(5, 1) NOT NULL DEFAULT 36
    CHECK (watermark_size_mm >= 10 AND watermark_size_mm <= 120),
  ADD COLUMN IF NOT EXISTS watermark_blur_px SMALLINT NOT NULL DEFAULT 0
    CHECK (watermark_blur_px >= 0 AND watermark_blur_px <= 20);

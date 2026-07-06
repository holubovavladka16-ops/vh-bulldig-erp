-- Firemní vodoznak pro všechna PDF (nahrává se jednou v nastavení společnosti)
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS watermark_url TEXT NOT NULL DEFAULT '';

-- Automatické vyplnění pracovní smlouvy
-- Spusťte po 011_module7_naklady.sql

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS director_name TEXT NOT NULL DEFAULT '';

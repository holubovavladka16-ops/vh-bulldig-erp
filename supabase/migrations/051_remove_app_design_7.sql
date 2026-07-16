-- Odstranit Design 7 (Field Operations) – vrátit na design_1 až design_6
UPDATE company_settings SET app_design = 'design_1' WHERE app_design = 'design_7';

ALTER TABLE company_settings DROP CONSTRAINT IF EXISTS company_settings_app_design_check;

ALTER TABLE company_settings
  ADD CONSTRAINT company_settings_app_design_check
  CHECK (app_design IN ('design_1', 'design_2', 'design_3', 'design_4', 'design_5', 'design_6'));

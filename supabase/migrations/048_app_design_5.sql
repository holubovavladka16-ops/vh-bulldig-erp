-- Povolit Design 5 (Executive Black Edition) jako firemní výchozí hodnotu
ALTER TABLE company_settings DROP CONSTRAINT IF EXISTS company_settings_app_design_check;

ALTER TABLE company_settings
  ADD CONSTRAINT company_settings_app_design_check
  CHECK (app_design IN ('design_1', 'design_2', 'design_3', 'design_4', 'design_5'));

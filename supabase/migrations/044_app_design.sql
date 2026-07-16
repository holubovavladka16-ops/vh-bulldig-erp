-- Firemní vzhled aplikace – Design 1 / Design 2
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS app_design TEXT NOT NULL DEFAULT 'design_1'
  CHECK (app_design IN ('design_1', 'design_2'));

-- Veřejné načtení vzhledu (přihlášení, portál) bez plného přístupu k company_settings
CREATE OR REPLACE FUNCTION get_app_design()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT app_design FROM company_settings ORDER BY updated_at DESC LIMIT 1),
    'design_1'
  );
$$;

GRANT EXECUTE ON FUNCTION get_app_design() TO anon, authenticated;

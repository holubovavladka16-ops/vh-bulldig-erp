-- Modul 1 – Registr ERP modulů
-- Spusťte v Supabase Dashboard → SQL Editor (po 002_module1_settings.sql)

CREATE TABLE erp_modules (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Box',
  sort_order INTEGER NOT NULL,
  is_implemented BOOLEAN NOT NULL DEFAULT false,
  module_version TEXT NOT NULL DEFAULT '0.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE erp_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Přihlášení vidí registr modulů"
  ON erp_modules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin spravuje registr modulů"
  ON erp_modules FOR ALL
  USING (get_user_role() = 'administrator');

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version) VALUES
  ('delnici', 'Dělníci', '/delnici', 'HardHat', 1, false, '0.0.0'),
  ('dochazka', 'Docházka', '/dochazka', 'Clock', 2, false, '0.0.0'),
  ('denni-formulare', 'Denní formuláře', '/denni-formulare', 'ClipboardPen', 3, false, '0.0.0'),
  ('zakazky', 'Zakázky', '/zakazky', 'ClipboardList', 4, false, '0.0.0'),
  ('vykazy', 'Výkazy', '/vykazy', 'FileSpreadsheet', 5, false, '0.0.0'),
  ('denik', 'Deník', '/denik', 'BookOpen', 6, false, '0.0.0'),
  ('ekonomika', 'Ekonomika', '/ekonomika', 'Landmark', 7, false, '0.0.0'),
  ('pripojky', 'Přípojky', '/pripojky', 'Cable', 8, false, '0.0.0'),
  ('fotky', 'Fotky', '/fotky', 'Camera', 9, false, '0.0.0'),
  ('dokumenty', 'Dokumenty', '/dokumenty', 'FileText', 10, false, '0.0.0'),
  ('statistiky', 'Statistiky', '/statistiky', 'BarChart3', 11, false, '0.0.0'),
  ('nastaveni', 'Nastavení', '/nastaveni', 'Settings', 12, true, '1.0.0');

-- Označení Modulu 1 jako implementovaného
UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id = 'nastaveni';

-- Admin může číst všechny profily (pro správu rolí)
CREATE POLICY "Admin čte všechny profily"
  ON profiles FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje role profilů"
  ON profiles FOR UPDATE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Uživatel upravuje svůj profil"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Automatické vytvoření app_settings po registraci
CREATE OR REPLACE FUNCTION handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.app_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_app_settings
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_settings();

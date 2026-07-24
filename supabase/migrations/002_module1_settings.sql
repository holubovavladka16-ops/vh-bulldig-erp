-- Modul 1 – Nastavení společnosti, aplikace a oprávnění
-- Spusťte v Supabase Dashboard → SQL Editor (po 001_initial_schema.sql)

-- ============================================================
-- Nastavení společnosti (singleton)
-- ============================================================

CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'VH Bulldig s.r.o.',
  ico TEXT DEFAULT '',
  dic TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  tagline TEXT DEFAULT 'Stavební a zemní práce',
  bank_account TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Vložení výchozího záznamu
INSERT INTO company_settings (company_name, tagline) VALUES ('VH Bulldig s.r.o.', 'Stavební a zemní práce');

-- ============================================================
-- Nastavení aplikace (per user)
-- ============================================================

CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  language TEXT NOT NULL DEFAULT 'cs',
  sidebar_collapsed BOOLEAN NOT NULL DEFAULT false,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_save_enabled BOOLEAN NOT NULL DEFAULT true,
  compact_mode BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Company settings: admin může číst a upravovat
CREATE POLICY "Admin čte nastavení společnosti"
  ON company_settings FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "Admin upravuje nastavení společnosti"
  ON company_settings FOR UPDATE
  USING (get_user_role() = 'administrator');

-- App settings: uživatel spravuje své nastavení
CREATE POLICY "Uživatel čte své nastavení aplikace"
  ON app_settings FOR SELECT
  USING (user_id = auth.uid() OR get_user_role() = 'administrator');

CREATE POLICY "Uživatel vytváří své nastavení"
  ON app_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Uživatel upravuje své nastavení"
  ON app_settings FOR UPDATE
  USING (user_id = auth.uid());

-- Trigger updated_at
CREATE TRIGGER company_settings_updated_at BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage bucket pro logo (spusťte v Supabase Storage)
-- Vytvořte bucket "company-assets" s veřejným přístupem pro logo

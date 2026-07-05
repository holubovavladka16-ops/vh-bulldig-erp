-- =============================================================================
-- VH Bulldig ERP - All Migrations (001-019)
-- Project: khhalcjgvqoyskkjlkyg
-- Run in Supabase Dashboard -> SQL Editor -> New query
-- Generated: 2026-07-05 21:17
-- =============================================================================


-- =============================================================================
-- MIGRATION: 001_initial_schema.sql
-- =============================================================================

-- VH Bulldig ERP – Počáteční databázové schéma
-- Spusťte v Supabase Dashboard → SQL Editor

-- ============================================================
-- ENUM typy
-- ============================================================

CREATE TYPE user_role AS ENUM ('administrator', 'vedouci', 'delnik');
CREATE TYPE project_status AS ENUM ('planovani', 'probiha', 'dokonceno', 'pozastaveno');
CREATE TYPE order_status AS ENUM ('nova', 'probiha', 'dokoncena', 'zrusena');
CREATE TYPE invoice_status AS ENUM ('koncept', 'odeslana', 'uhrazena', 'po_splatnosti');
CREATE TYPE payroll_status AS ENUM ('vypocitana', 'schvalena', 'vyplacena');
CREATE TYPE vehicle_status AS ENUM ('aktivni', 'servis', 'neaktivni');

-- ============================================================
-- Profily uživatelů (rozšíření auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'delnik',
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Zaměstnanci
-- ============================================================

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  employee_number TEXT NOT NULL UNIQUE,
  "position" TEXT NOT NULL,
  department TEXT,
  hire_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Projekty
-- ============================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  status project_status NOT NULL DEFAULT 'planovani',
  start_date DATE,
  end_date DATE,
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Zakázky
-- ============================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  description TEXT,
  status order_status NOT NULL DEFAULT 'nova',
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Docházka
-- ============================================================

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  hours_worked NUMERIC(4, 2),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

-- ============================================================
-- Fakturace
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'koncept',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Mzdy
-- ============================================================

CREATE TABLE payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  gross_amount NUMERIC(12, 2) NOT NULL,
  net_amount NUMERIC(12, 2) NOT NULL,
  status payroll_status NOT NULL DEFAULT 'vypocitana',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_month, period_year)
);

-- ============================================================
-- Sklady
-- ============================================================

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE warehouse_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'ks',
  min_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Dokumenty
-- ============================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Vozový park
-- ============================================================

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  status vehicle_status NOT NULL DEFAULT 'aktivni',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Reporty
-- ============================================================

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  report_type TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Trigger: automatické vytvoření profilu po registraci
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'delnik')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Trigger: aktualizace updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Pomocná funkce pro získání role aktuálního uživatele
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: každý vidí svůj profil, admin vidí vše
CREATE POLICY "Uživatel vidí svůj profil"
  ON profiles FOR SELECT
  USING (id = auth.uid() OR get_user_role() = 'administrator');

CREATE POLICY "Admin může upravovat profily"
  ON profiles FOR UPDATE
  USING (get_user_role() = 'administrator');

-- Employees: admin a vedoucí vidí vše, dělník jen sebe
CREATE POLICY "Admin a vedoucí vidí zaměstnance"
  ON employees FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje zaměstnance"
  ON employees FOR ALL
  USING (get_user_role() = 'administrator');

-- Projects: všichni přihlášení vidí projekty
CREATE POLICY "Přihlášení vidí projekty"
  ON projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin a vedoucí spravují projekty"
  ON projects FOR ALL
  USING (get_user_role() IN ('administrator', 'vedouci'));

-- Orders: admin a vedoucí
CREATE POLICY "Admin a vedoucí vidí zakázky"
  ON orders FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin a vedoucí spravují zakázky"
  ON orders FOR ALL
  USING (get_user_role() IN ('administrator', 'vedouci'));

-- Attendance: všichni vidí, dělník může zapisovat svou docházku
CREATE POLICY "Přihlášení vidí docházku"
  ON attendance FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Přihlášení zapisují docházku"
  ON attendance FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Invoices: admin a vedoucí
CREATE POLICY "Admin a vedoucí vidí faktury"
  ON invoices FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje faktury"
  ON invoices FOR ALL
  USING (get_user_role() = 'administrator');

-- Payroll: pouze admin
CREATE POLICY "Admin vidí mzdy"
  ON payroll FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje mzdy"
  ON payroll FOR ALL
  USING (get_user_role() = 'administrator');

-- Warehouses: admin a vedoucí
CREATE POLICY "Admin a vedoucí vidí sklady"
  ON warehouses FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin a vedoucí spravují sklady"
  ON warehouses FOR ALL
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin a vedoucí vidí položky skladu"
  ON warehouse_items FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin a vedoucí spravují položky skladu"
  ON warehouse_items FOR ALL
  USING (get_user_role() IN ('administrator', 'vedouci'));

-- Documents: všichni vidí
CREATE POLICY "Přihlášení vidí dokumenty"
  ON documents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin a vedoucí nahrávají dokumenty"
  ON documents FOR INSERT
  WITH CHECK (get_user_role() IN ('administrator', 'vedouci'));

-- Vehicles: admin a vedoucí
CREATE POLICY "Admin a vedoucí vidí vozidla"
  ON vehicles FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin a vedoucí spravují vozidla"
  ON vehicles FOR ALL
  USING (get_user_role() IN ('administrator', 'vedouci'));

-- Reports: admin a vedoucí
CREATE POLICY "Admin a vedoucí vidí reporty"
  ON reports FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin a vedoucí vytváří reporty"
  ON reports FOR INSERT
  WITH CHECK (get_user_role() IN ('administrator', 'vedouci'));

-- ============================================================
-- Indexy pro výkon
-- ============================================================

CREATE INDEX idx_employees_profile ON employees(profile_id);
CREATE INDEX idx_projects_manager ON projects(manager_id);
CREATE INDEX idx_orders_project ON orders(project_id);
CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_payroll_employee_period ON payroll(employee_id, period_year, period_month);


-- =============================================================================
-- MIGRATION: 002_module1_settings.sql
-- =============================================================================

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


-- =============================================================================
-- MIGRATION: 003_module1_registry.sql
-- =============================================================================

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


-- =============================================================================
-- MIGRATION: 004_module2_delnici.sql
-- =============================================================================

-- Modul 2 – Dělníci (Personalistika)
-- Spusťte v Supabase Dashboard → SQL Editor (po 003_module1_registry.sql)

-- ============================================================
-- ENUM typy
-- ============================================================

CREATE TYPE employment_type AS ENUM ('HPP', 'DPP', 'DPC', 'ICO');
CREATE TYPE worker_status AS ENUM ('aktivni', 'neaktivni', 'archiv');
CREATE TYPE worker_document_category AS ENUM (
  'pracovni_smlouva', 'dodatek', 'obcansky_prukaz', 'ridicsky_prukaz',
  'lekarska_prohlidka', 'bozp', 'certifikat', 'ostatni'
);
CREATE TYPE worker_form_status AS ENUM ('koncept', 'odeslany', 'schvaleny', 'k_oprave');
CREATE TYPE worker_report_status AS ENUM ('cekajici', 'schvaleny', 'k_oprave');
CREATE TYPE price_unit_type AS ENUM ('hodina', 'metr', 'kus', 'pausal');

-- ============================================================
-- Zaměstnanci (Dělníci)
-- ============================================================

CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT NOT NULL,
  birth_date DATE NOT NULL,
  start_date DATE NOT NULL,
  employment_type employment_type NOT NULL,
  "position" TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  birth_number TEXT,
  nationality TEXT,
  note TEXT,
  photo_url TEXT,
  status worker_status NOT NULL DEFAULT 'aktivni',
  portal_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  end_date DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workers_status ON workers(status);
CREATE INDEX idx_workers_name ON workers(last_name, first_name);
CREATE INDEX idx_workers_portal_token ON workers(portal_token);

-- ============================================================
-- Individuální ceník
-- ============================================================

CREATE TABLE worker_price_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit_type price_unit_type NOT NULL DEFAULT 'hodina',
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, name)
);

-- ============================================================
-- Dokumenty zaměstnance
-- ============================================================

CREATE TABLE worker_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  category worker_document_category NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Denní formuláře
-- ============================================================

CREATE TABLE worker_daily_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  form_date DATE NOT NULL,
  order_name TEXT NOT NULL DEFAULT '',
  activity TEXT NOT NULL,
  price_item_id UUID REFERENCES worker_price_items(id) ON DELETE SET NULL,
  hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  meters NUMERIC(10, 2) NOT NULL DEFAULT 0,
  pieces NUMERIC(10, 2) NOT NULL DEFAULT 0,
  advance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT,
  earnings NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status worker_form_status NOT NULL DEFAULT 'koncept',
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE worker_form_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES worker_daily_forms(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Výkazy
-- ============================================================

CREATE TABLE worker_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  form_id UUID REFERENCES worker_daily_forms(id) ON DELETE SET NULL,
  report_date DATE NOT NULL,
  order_name TEXT NOT NULL DEFAULT '',
  activity TEXT NOT NULL,
  hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  meters NUMERIC(10, 2) NOT NULL DEFAULT 0,
  pieces NUMERIC(10, 2) NOT NULL DEFAULT 0,
  earnings NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status worker_report_status NOT NULL DEFAULT 'cekajici',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Docházka
-- ============================================================

CREATE TABLE worker_attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  form_id UUID REFERENCES worker_daily_forms(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL,
  hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, attendance_date)
);

-- ============================================================
-- Historie
-- ============================================================

CREATE TABLE worker_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Statistiky (propojení s budoucími moduly)
-- ============================================================

CREATE TABLE worker_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  earnings NUMERIC(12, 2) NOT NULL DEFAULT 0,
  hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  meters NUMERIC(10, 2) NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  advances NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_id, stat_date)
);

-- ============================================================
-- Triggery updated_at
-- ============================================================

CREATE TRIGGER workers_updated_at BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER worker_price_items_updated_at BEFORE UPDATE ON worker_price_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER worker_daily_forms_updated_at BEFORE UPDATE ON worker_daily_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Výchozí ceník při vytvoření zaměstnance
-- ============================================================

CREATE OR REPLACE FUNCTION create_worker_defaults()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO worker_price_items (worker_id, name, unit_type, price, is_default, sort_order) VALUES
    (NEW.id, 'Hodinová sazba', 'hodina', 0, true, 1),
    (NEW.id, 'Ruční výkop', 'metr', 0, true, 2),
    (NEW.id, 'Pokládka HDPE', 'metr', 0, true, 3),
    (NEW.id, 'Pokládka Multiduct', 'metr', 0, true, 4),
    (NEW.id, 'Tahání trubiček', 'metr', 0, true, 5),
    (NEW.id, 'Průraz do objektu', 'pausal', 0, true, 6),
    (NEW.id, 'Stavění pilíře', 'kus', 0, true, 7),
    (NEW.id, 'Spojování', 'kus', 0, true, 8),
    (NEW.id, 'Řezání asfaltu', 'metr', 0, true, 9),
    (NEW.id, 'Demontáž dlažby', 'metr', 0, true, 10),
    (NEW.id, 'Pokládka dlažby', 'metr', 0, true, 11),
    (NEW.id, 'Pískování', 'metr', 0, true, 12),
    (NEW.id, 'Jiná práce', 'hodina', 0, true, 13);

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (NEW.id, 'Zaměstnanec vytvořen', jsonb_build_object(
    'first_name', NEW.first_name,
    'last_name', NEW.last_name
  ), NEW.created_by);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_worker_created
  AFTER INSERT ON workers
  FOR EACH ROW EXECUTE FUNCTION create_worker_defaults();

-- ============================================================
-- Výpočet výdělku
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_worker_earnings(
  p_unit_type price_unit_type,
  p_price NUMERIC,
  p_hours NUMERIC,
  p_meters NUMERIC,
  p_pieces NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
  CASE p_unit_type
    WHEN 'hodina' THEN RETURN COALESCE(p_hours, 0) * p_price;
    WHEN 'metr' THEN RETURN COALESCE(p_meters, 0) * p_price;
    WHEN 'kus' THEN RETURN COALESCE(p_pieces, 0) * p_price;
    WHEN 'pausal' THEN RETURN p_price;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- Odeslání formuláře – automatické propojení
-- ============================================================

CREATE OR REPLACE FUNCTION submit_worker_daily_form(p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_item worker_price_items%ROWTYPE;
  v_earnings NUMERIC;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id FOR UPDATE;

  IF v_form.status NOT IN ('koncept', 'k_oprave') THEN
    RAISE EXCEPTION 'Formulář nelze odeslat v aktuálním stavu';
  END IF;

  IF v_form.price_item_id IS NOT NULL THEN
    SELECT * INTO v_item FROM worker_price_items WHERE id = v_form.price_item_id;
    v_earnings := calculate_worker_earnings(v_item.unit_type, v_item.price, v_form.hours, v_form.meters, v_form.pieces);
  ELSE
    v_earnings := 0;
  END IF;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    status = 'odeslany',
    submitted_at = now()
  WHERE id = p_form_id;

  IF EXISTS (SELECT 1 FROM worker_reports WHERE form_id = p_form_id) THEN
    UPDATE worker_reports SET
      report_date = v_form.form_date, order_name = v_form.order_name, activity = v_form.activity,
      hours = v_form.hours, meters = v_form.meters, pieces = v_form.pieces,
      earnings = v_earnings, status = 'cekajici'
    WHERE form_id = p_form_id;
  ELSE
    INSERT INTO worker_reports (worker_id, form_id, report_date, order_name, activity, hours, meters, pieces, earnings, status)
    VALUES (v_form.worker_id, p_form_id, v_form.form_date, v_form.order_name, v_form.activity, v_form.hours, v_form.meters, v_form.pieces, v_earnings, 'cekajici');
  END IF;

  INSERT INTO worker_attendance_records (worker_id, form_id, attendance_date, hours)
  VALUES (v_form.worker_id, p_form_id, v_form.form_date, v_form.hours)
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET hours = worker_attendance_records.hours + EXCLUDED.hours, form_id = EXCLUDED.form_id;

  INSERT INTO worker_statistics (worker_id, stat_date, earnings, hours, meters, orders_count, advances)
  VALUES (v_form.worker_id, v_form.form_date, v_earnings, v_form.hours, v_form.meters, 1, v_form.advance)
  ON CONFLICT (worker_id, stat_date)
  DO UPDATE SET
    earnings = worker_statistics.earnings + EXCLUDED.earnings,
    hours = worker_statistics.hours + EXCLUDED.hours,
    meters = worker_statistics.meters + EXCLUDED.meters,
    orders_count = worker_statistics.orders_count + 1,
    advances = worker_statistics.advances + EXCLUDED.advances;

  INSERT INTO worker_history (worker_id, action, details)
  VALUES (v_form.worker_id, 'Formulář odeslán', jsonb_build_object('form_id', p_form_id, 'earnings', v_earnings));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_price_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_daily_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_form_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_statistics ENABLE ROW LEVEL SECURITY;

-- Admin a vedoucí – čtení
CREATE POLICY "Admin a vedoucí čtou zaměstnance"
  ON workers FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje zaměstnance"
  ON workers FOR ALL
  USING (get_user_role() = 'administrator');

-- Ceník
CREATE POLICY "Admin a vedoucí čtou ceník"
  ON worker_price_items FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje ceník"
  ON worker_price_items FOR ALL
  USING (get_user_role() = 'administrator');

-- Dokumenty
CREATE POLICY "Admin a vedoucí čtou dokumenty"
  ON worker_documents FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje dokumenty"
  ON worker_documents FOR ALL
  USING (get_user_role() = 'administrator');

-- Formuláře
CREATE POLICY "Admin a vedoucí čtou formuláře"
  ON worker_daily_forms FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje formuláře"
  ON worker_daily_forms FOR ALL
  USING (get_user_role() = 'administrator');

-- Fotografie formulářů
CREATE POLICY "Admin spravuje fotografie formulářů"
  ON worker_form_photos FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin a vedoucí čtou fotografie"
  ON worker_form_photos FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

-- Výkazy, docházka, historie, statistiky
CREATE POLICY "Admin a vedoucí čtou výkazy"
  ON worker_reports FOR SELECT USING (get_user_role() IN ('administrator', 'vedouci'));
CREATE POLICY "Admin spravuje výkazy"
  ON worker_reports FOR ALL USING (get_user_role() = 'administrator');

CREATE POLICY "Admin a vedoucí čtou docházku"
  ON worker_attendance_records FOR SELECT USING (get_user_role() IN ('administrator', 'vedouci'));
CREATE POLICY "Admin spravuje docházku"
  ON worker_attendance_records FOR ALL USING (get_user_role() = 'administrator');

CREATE POLICY "Admin a vedoucí čtou historii"
  ON worker_history FOR SELECT USING (get_user_role() IN ('administrator', 'vedouci'));
CREATE POLICY "Admin zapisuje historii"
  ON worker_history FOR INSERT WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin a vedoucí čtou statistiky"
  ON worker_statistics FOR SELECT USING (get_user_role() IN ('administrator', 'vedouci'));
CREATE POLICY "Admin spravuje statistiky"
  ON worker_statistics FOR ALL USING (get_user_role() = 'administrator');

-- ============================================================
-- Portál zaměstnance – RPC funkce (bez přihlášení)
-- ============================================================

CREATE OR REPLACE FUNCTION portal_get_worker(p_token UUID)
RETURNS TABLE (
  id UUID, first_name TEXT, last_name TEXT, "position" TEXT, status worker_status
) AS $$
  SELECT w.id, w.first_name, w.last_name, w."position", w.status
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION portal_get_price_items(p_token UUID)
RETURNS SETOF worker_price_items AS $$
  SELECT pi.*
  FROM worker_price_items pi
  JOIN workers w ON w.id = pi.worker_id
  WHERE w.portal_token = p_token AND w.status = 'aktivni'
  ORDER BY pi.sort_order;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION portal_get_forms(p_token UUID)
RETURNS SETOF worker_daily_forms AS $$
  SELECT f.*
  FROM worker_daily_forms f
  JOIN workers w ON w.id = f.worker_id
  WHERE w.portal_token = p_token
  ORDER BY f.form_date DESC, f.created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION portal_get_reports(p_token UUID)
RETURNS SETOF worker_reports AS $$
  SELECT r.*
  FROM worker_reports r
  JOIN workers w ON w.id = r.worker_id
  WHERE w.portal_token = p_token
  ORDER BY r.report_date DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION portal_get_earnings_summary(p_token UUID)
RETURNS TABLE (
  today_earnings NUMERIC,
  month_earnings NUMERIC,
  month_hours NUMERIC,
  month_meters NUMERIC,
  month_orders INTEGER,
  month_advances NUMERIC
) AS $$
DECLARE
  v_worker_id UUID;
BEGIN
  SELECT w.id INTO v_worker_id FROM workers w WHERE w.portal_token = p_token AND w.status = 'aktivni';
  IF v_worker_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(earnings) FROM worker_daily_forms WHERE worker_id = v_worker_id AND form_date = CURRENT_DATE AND status IN ('odeslany', 'schvaleny')), 0),
    COALESCE((SELECT SUM(earnings) FROM worker_reports WHERE worker_id = v_worker_id AND report_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(hours) FROM worker_attendance_records WHERE worker_id = v_worker_id AND attendance_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(meters) FROM worker_statistics WHERE worker_id = v_worker_id AND stat_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(orders_count)::INTEGER FROM worker_statistics WHERE worker_id = v_worker_id AND stat_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(advances) FROM worker_statistics WHERE worker_id = v_worker_id AND stat_date >= date_trunc('month', CURRENT_DATE)::date), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION portal_save_form(
  p_token UUID,
  p_form_id UUID,
  p_form_date DATE,
  p_order_name TEXT,
  p_activity TEXT,
  p_price_item_id UUID,
  p_hours NUMERIC,
  p_meters NUMERIC,
  p_pieces NUMERIC,
  p_advance NUMERIC,
  p_note TEXT
) RETURNS UUID AS $$
DECLARE
  v_worker_id UUID;
  v_item worker_price_items%ROWTYPE;
  v_earnings NUMERIC;
  v_form_id UUID;
BEGIN
  SELECT w.id INTO v_worker_id FROM workers w WHERE w.portal_token = p_token AND w.status = 'aktivni';
  IF v_worker_id IS NULL THEN RAISE EXCEPTION 'Neplatný přístup'; END IF;

  IF p_form_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM worker_daily_forms
      WHERE id = p_form_id AND worker_id = v_worker_id AND status IN ('koncept', 'k_oprave')
    ) THEN
      RAISE EXCEPTION 'Formulář nelze upravovat';
    END IF;
  END IF;

  IF p_price_item_id IS NOT NULL THEN
    SELECT * INTO v_item FROM worker_price_items WHERE id = p_price_item_id AND worker_id = v_worker_id;
    v_earnings := calculate_worker_earnings(v_item.unit_type, v_item.price, p_hours, p_meters, p_pieces);
  ELSE
    v_earnings := 0;
  END IF;

  IF p_form_id IS NULL THEN
    INSERT INTO worker_daily_forms (worker_id, form_date, order_name, activity, price_item_id, hours, meters, pieces, advance, note, earnings)
    VALUES (v_worker_id, p_form_date, p_order_name, p_activity, p_price_item_id, p_hours, p_meters, p_pieces, p_advance, p_note, v_earnings)
    RETURNING id INTO v_form_id;
  ELSE
    UPDATE worker_daily_forms SET
      form_date = p_form_date, order_name = p_order_name, activity = p_activity,
      price_item_id = p_price_item_id, hours = p_hours, meters = p_meters,
      pieces = p_pieces, advance = p_advance, note = p_note, earnings = v_earnings
    WHERE id = p_form_id AND worker_id = v_worker_id
    RETURNING id INTO v_form_id;
  END IF;

  RETURN v_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION portal_submit_form(p_token UUID, p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_worker_id UUID;
BEGIN
  SELECT w.id INTO v_worker_id FROM workers w WHERE w.portal_token = p_token AND w.status = 'aktivni';
  IF v_worker_id IS NULL THEN RAISE EXCEPTION 'Neplatný přístup'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM worker_daily_forms WHERE id = p_form_id AND worker_id = v_worker_id AND status IN ('koncept', 'k_oprave')
  ) THEN
    RAISE EXCEPTION 'Formulář nelze odeslat';
  END IF;

  PERFORM submit_worker_daily_form(p_form_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION portal_get_worker(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION portal_get_price_items(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION portal_get_forms(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION portal_get_reports(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION portal_get_earnings_summary(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION portal_save_form(UUID, UUID, DATE, TEXT, TEXT, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION portal_submit_form(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_worker_daily_form(UUID) TO authenticated;

-- ============================================================
-- Registr modulů
-- ============================================================

UPDATE erp_modules SET is_implemented = true, module_version = '2.0.0' WHERE id = 'delnici';

-- Storage: vytvořte buckety worker-documents a worker-photos (Supabase Storage)


-- =============================================================================
-- MIGRATION: 005_module2_storage.sql
-- =============================================================================

-- Modul 2 – Storage a portál fotografie
-- Spusťte po 004_module2_delnici.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('worker-photos', 'worker-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('worker-documents', 'worker-documents', false, 10485760, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autentizovaní nahrávají fotografie"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'worker-photos');

CREATE POLICY "Veřejné čtení fotografií"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'worker-photos');

CREATE POLICY "Anon nahrávají fotografie formuláře"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'worker-photos');

CREATE POLICY "Admin nahrává dokumenty"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'worker-documents');

CREATE POLICY "Autentizovaní čtou dokumenty"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'worker-documents');

CREATE OR REPLACE FUNCTION portal_add_form_photo(
  p_token UUID,
  p_form_id UUID,
  p_file_path TEXT,
  p_file_name TEXT
) RETURNS VOID AS $$
DECLARE
  v_worker_id UUID;
BEGIN
  SELECT w.id INTO v_worker_id FROM workers w WHERE w.portal_token = p_token AND w.status = 'aktivni';
  IF v_worker_id IS NULL THEN RAISE EXCEPTION 'Neplatný přístup'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM worker_daily_forms
    WHERE id = p_form_id AND worker_id = v_worker_id AND status IN ('koncept', 'k_oprave')
  ) THEN
    RAISE EXCEPTION 'Formulář nelze upravovat';
  END IF;

  INSERT INTO worker_form_photos (form_id, file_path, file_name)
  VALUES (p_form_id, p_file_path, p_file_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION portal_add_form_photo(UUID, UUID, TEXT, TEXT) TO anon, authenticated;


-- =============================================================================
-- MIGRATION: 006_module2_work_types.sql
-- =============================================================================

-- Modul 2 – Typ práce (Hodinová / Úkolová / Kombinovaná)
-- Spusťte po 005_module2_storage.sql

CREATE TYPE work_type AS ENUM ('hodinova', 'ukolova', 'kombinovana');

ALTER TABLE worker_daily_forms
  ADD COLUMN IF NOT EXISTS work_type work_type NOT NULL DEFAULT 'ukolova',
  ADD COLUMN IF NOT EXISTS work_description TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS worker_form_task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES worker_daily_forms(id) ON DELETE CASCADE,
  price_item_id UUID NOT NULL REFERENCES worker_price_items(id) ON DELETE CASCADE,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  line_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_task_items_form ON worker_form_task_items(form_id);

ALTER TABLE worker_form_task_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin a vedoucí čtou položky formuláře"
  ON worker_form_task_items FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje položky formuláře"
  ON worker_form_task_items FOR ALL
  USING (get_user_role() = 'administrator');

-- Výdělek z úkolové položky – pouze podle množství, nikdy podle hodin
CREATE OR REPLACE FUNCTION calculate_task_line_earnings(
  p_unit_type price_unit_type,
  p_price NUMERIC,
  p_quantity NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
  CASE p_unit_type
    WHEN 'metr' THEN RETURN COALESCE(p_quantity, 0) * p_price;
    WHEN 'kus' THEN RETURN COALESCE(p_quantity, 0) * p_price;
    WHEN 'pausal' THEN
      RETURN CASE WHEN COALESCE(p_quantity, 0) > 0 THEN p_price * p_quantity ELSE 0 END;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Celkový výdělek formuláře dle typu práce
CREATE OR REPLACE FUNCTION calculate_form_earnings(p_form_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_hourly_item worker_price_items%ROWTYPE;
  v_total NUMERIC := 0;
  v_task_sum NUMERIC := 0;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO v_hourly_item FROM worker_price_items
  WHERE worker_id = v_form.worker_id AND name = 'Hodinová sazba'
  LIMIT 1;

  IF v_form.work_type IN ('hodinova', 'kombinovana') THEN
    IF v_hourly_item.id IS NOT NULL THEN
      v_total := v_total + (COALESCE(v_form.hours, 0) * v_hourly_item.price);
    END IF;
  END IF;

  IF v_form.work_type IN ('ukolova', 'kombinovana') THEN
    SELECT COALESCE(SUM(line_earnings), 0) INTO v_task_sum
    FROM worker_form_task_items WHERE form_id = p_form_id;
    v_total := v_total + v_task_sum;
  END IF;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- Uložení úkolových položek z JSON pole
CREATE OR REPLACE FUNCTION save_form_task_items(
  p_form_id UUID,
  p_worker_id UUID,
  p_task_items JSONB
) RETURNS VOID AS $$
DECLARE
  v_item JSONB;
  v_price_item worker_price_items%ROWTYPE;
  v_quantity NUMERIC;
  v_earnings NUMERIC;
  v_sort INTEGER := 0;
BEGIN
  DELETE FROM worker_form_task_items WHERE form_id = p_form_id;

  IF p_task_items IS NULL OR jsonb_array_length(p_task_items) = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_task_items)
  LOOP
    v_sort := v_sort + 1;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    SELECT * INTO v_price_item FROM worker_price_items
    WHERE id = (v_item->>'price_item_id')::UUID
      AND worker_id = p_worker_id
      AND name <> 'Hodinová sazba';

    IF NOT FOUND THEN CONTINUE; END IF;

    v_earnings := calculate_task_line_earnings(v_price_item.unit_type, v_price_item.price, v_quantity);

    INSERT INTO worker_form_task_items (form_id, price_item_id, quantity, line_earnings, sort_order)
    VALUES (p_form_id, v_price_item.id, v_quantity, v_earnings, v_sort);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Odvození popisu aktivity pro výkaz
CREATE OR REPLACE FUNCTION derive_form_activity(
  p_work_type work_type,
  p_work_description TEXT,
  p_form_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_tasks TEXT;
BEGIN
  IF p_work_type = 'hodinova' THEN
    RETURN COALESCE(NULLIF(p_work_description, ''), 'Hodinová práce');
  END IF;

  SELECT string_agg(pi.name || ' (' || ti.quantity::TEXT || ')', ', ' ORDER BY ti.sort_order)
  INTO v_tasks
  FROM worker_form_task_items ti
  JOIN worker_price_items pi ON pi.id = ti.price_item_id
  WHERE ti.form_id = p_form_id AND ti.quantity > 0;

  IF p_work_type = 'ukolova' THEN
    RETURN COALESCE(v_tasks, 'Úkolová práce');
  END IF;

  RETURN 'Kombinovaná: ' || COALESCE(NULLIF(p_work_description, ''), '—') ||
    CASE WHEN v_tasks IS NOT NULL THEN ' | ' || v_tasks ELSE '' END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Souhrn metrů/kusů z úkolových položek
CREATE OR REPLACE FUNCTION derive_form_totals(p_form_id UUID)
RETURNS TABLE (total_meters NUMERIC, total_pieces NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN pi.unit_type = 'metr' THEN ti.quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pi.unit_type IN ('kus', 'pausal') THEN ti.quantity ELSE 0 END), 0)
  FROM worker_form_task_items ti
  JOIN worker_price_items pi ON pi.id = ti.price_item_id
  WHERE ti.form_id = p_form_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Aktualizace submit_worker_daily_form
CREATE OR REPLACE FUNCTION submit_worker_daily_form(p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id FOR UPDATE;

  IF v_form.status NOT IN ('koncept', 'k_oprave') THEN
    RAISE EXCEPTION 'Formulář nelze odeslat v aktuálním stavu';
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(v_form.work_type, v_form.work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces,
    status = 'odeslany',
    submitted_at = now()
  WHERE id = p_form_id;

  IF EXISTS (SELECT 1 FROM worker_reports WHERE form_id = p_form_id) THEN
    UPDATE worker_reports SET
      report_date = v_form.form_date, order_name = v_form.order_name, activity = v_activity,
      hours = v_form.hours, meters = v_meters, pieces = v_pieces,
      earnings = v_earnings, status = 'cekajici'
    WHERE form_id = p_form_id;
  ELSE
    INSERT INTO worker_reports (worker_id, form_id, report_date, order_name, activity, hours, meters, pieces, earnings, status)
    VALUES (v_form.worker_id, p_form_id, v_form.form_date, v_form.order_name, v_activity, v_form.hours, v_meters, v_pieces, v_earnings, 'cekajici');
  END IF;

  INSERT INTO worker_attendance_records (worker_id, form_id, attendance_date, hours)
  VALUES (v_form.worker_id, p_form_id, v_form.form_date, v_form.hours)
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET hours = worker_attendance_records.hours + EXCLUDED.hours, form_id = EXCLUDED.form_id;

  INSERT INTO worker_statistics (worker_id, stat_date, earnings, hours, meters, orders_count, advances)
  VALUES (v_form.worker_id, v_form.form_date, v_earnings, v_form.hours, v_meters, 1, v_form.advance)
  ON CONFLICT (worker_id, stat_date)
  DO UPDATE SET
    earnings = worker_statistics.earnings + EXCLUDED.earnings,
    hours = worker_statistics.hours + EXCLUDED.hours,
    meters = worker_statistics.meters + EXCLUDED.meters,
    orders_count = worker_statistics.orders_count + 1,
    advances = worker_statistics.advances + EXCLUDED.advances;

  INSERT INTO worker_history (worker_id, action, details)
  VALUES (v_form.worker_id, 'Formulář odeslán', jsonb_build_object(
    'form_id', p_form_id, 'earnings', v_earnings, 'work_type', v_form.work_type
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nová portal_save_form s typem práce
DROP FUNCTION IF EXISTS portal_save_form(UUID, UUID, DATE, TEXT, TEXT, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION portal_save_form(
  p_token UUID,
  p_form_id UUID,
  p_form_date DATE,
  p_order_name TEXT,
  p_work_type work_type,
  p_work_description TEXT,
  p_hours NUMERIC,
  p_advance NUMERIC,
  p_note TEXT,
  p_task_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_worker_id UUID;
  v_form_id UUID;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  SELECT w.id INTO v_worker_id FROM workers w WHERE w.portal_token = p_token AND w.status = 'aktivni';
  IF v_worker_id IS NULL THEN RAISE EXCEPTION 'Neplatný přístup'; END IF;

  IF p_form_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM worker_daily_forms
      WHERE id = p_form_id AND worker_id = v_worker_id AND status IN ('koncept', 'k_oprave')
    ) THEN
      RAISE EXCEPTION 'Formulář nelze upravovat';
    END IF;
  END IF;

  IF p_form_id IS NULL THEN
    INSERT INTO worker_daily_forms (
      worker_id, form_date, order_name, activity, work_type, work_description,
      hours, meters, pieces, advance, note, earnings
    )
    VALUES (
      v_worker_id, p_form_date, p_order_name, '', p_work_type, COALESCE(p_work_description, ''),
      p_hours, 0, 0, p_advance, p_note, 0
    )
    RETURNING id INTO v_form_id;
  ELSE
    UPDATE worker_daily_forms SET
      form_date = p_form_date,
      order_name = p_order_name,
      work_type = p_work_type,
      work_description = COALESCE(p_work_description, ''),
      hours = p_hours,
      advance = p_advance,
      note = p_note,
      price_item_id = NULL
    WHERE id = p_form_id AND worker_id = v_worker_id
    RETURNING id INTO v_form_id;
  END IF;

  IF p_work_type IN ('ukolova', 'kombinovana') THEN
    PERFORM save_form_task_items(v_form_id, v_worker_id, p_task_items);
  ELSE
    DELETE FROM worker_form_task_items WHERE form_id = v_form_id;
  END IF;

  v_earnings := calculate_form_earnings(v_form_id);
  v_activity := derive_form_activity(p_work_type, p_work_description, v_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(v_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces
  WHERE id = v_form_id;

  RETURN v_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin úprava formuláře
CREATE OR REPLACE FUNCTION admin_save_form(
  p_form_id UUID,
  p_form_date DATE,
  p_order_name TEXT,
  p_work_type work_type,
  p_work_description TEXT,
  p_hours NUMERIC,
  p_advance NUMERIC,
  p_note TEXT,
  p_task_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_worker_id UUID;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT worker_id INTO v_worker_id FROM worker_daily_forms WHERE id = p_form_id;
  IF v_worker_id IS NULL THEN RAISE EXCEPTION 'Formulář nenalezen'; END IF;

  UPDATE worker_daily_forms SET
    form_date = p_form_date,
    order_name = p_order_name,
    work_type = p_work_type,
    work_description = COALESCE(p_work_description, ''),
    hours = p_hours,
    advance = p_advance,
    note = p_note
  WHERE id = p_form_id;

  IF p_work_type IN ('ukolova', 'kombinovana') THEN
    PERFORM save_form_task_items(p_form_id, v_worker_id, p_task_items);
  ELSE
    DELETE FROM worker_form_task_items WHERE form_id = p_form_id;
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(p_work_type, p_work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces
  WHERE id = p_form_id;

  RETURN p_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION portal_get_form_task_items(p_token UUID, p_form_id UUID)
RETURNS TABLE (
  id UUID,
  price_item_id UUID,
  quantity NUMERIC,
  line_earnings NUMERIC,
  sort_order INTEGER,
  item_name TEXT,
  unit_type price_unit_type
) AS $$
BEGIN
  RETURN QUERY
  SELECT ti.id, ti.price_item_id, ti.quantity, ti.line_earnings, ti.sort_order, pi.name, pi.unit_type
  FROM worker_form_task_items ti
  JOIN worker_price_items pi ON pi.id = ti.price_item_id
  JOIN worker_daily_forms f ON f.id = ti.form_id
  JOIN workers w ON w.id = f.worker_id
  WHERE w.portal_token = p_token AND ti.form_id = p_form_id
  ORDER BY ti.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION admin_get_form_task_items(p_form_id UUID)
RETURNS TABLE (
  id UUID,
  price_item_id UUID,
  quantity NUMERIC,
  line_earnings NUMERIC,
  sort_order INTEGER,
  item_name TEXT,
  unit_type price_unit_type
) AS $$
BEGIN
  IF get_user_role() NOT IN ('administrator', 'vedouci') THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  RETURN QUERY
  SELECT ti.id, ti.price_item_id, ti.quantity, ti.line_earnings, ti.sort_order, pi.name, pi.unit_type
  FROM worker_form_task_items ti
  JOIN worker_price_items pi ON pi.id = ti.price_item_id
  WHERE ti.form_id = p_form_id
  ORDER BY ti.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION portal_save_form(UUID, UUID, DATE, TEXT, work_type, TEXT, NUMERIC, NUMERIC, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_save_form(UUID, DATE, TEXT, work_type, TEXT, NUMERIC, NUMERIC, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION portal_get_form_task_items(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_get_form_task_items(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_form_earnings(UUID) TO authenticated;


-- =============================================================================
-- MIGRATION: 007_module3_osobni_cenik.sql
-- =============================================================================

-- Modul 3 – Osobní ceník zaměstnance
-- Spusťte po 006_module2_work_types.sql

ALTER TYPE price_unit_type ADD VALUE IF NOT EXISTS 'm2';
ALTER TYPE price_unit_type ADD VALUE IF NOT EXISTS 'den';

ALTER TABLE worker_price_items
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_worker_price_items_active
  ON worker_price_items(worker_id, is_active, sort_order);

-- Výchozí ceník pro nově vytvořené zaměstnance (8 položek dle specifikace)
CREATE OR REPLACE FUNCTION create_worker_defaults()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO worker_price_items (worker_id, name, unit_type, price, is_default, is_active, sort_order) VALUES
    (NEW.id, 'Hodinová sazba', 'hodina', 0, true, true, 1),
    (NEW.id, 'Ruční výkop hloubka 50–70 cm', 'metr', 0, true, true, 2),
    (NEW.id, 'Ruční výkop hloubka 80–100 cm', 'metr', 0, true, true, 3),
    (NEW.id, 'Průraz do objektu', 'kus', 0, true, true, 4),
    (NEW.id, 'Demontáž zámkové dlažby', 'm2', 0, true, true, 5),
    (NEW.id, 'Pokládka zámkové dlažby', 'm2', 0, true, true, 6),
    (NEW.id, 'Denní úkol', 'den', 0, true, true, 7),
    (NEW.id, 'Jiné', 'kus', 0, true, true, 8);

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (NEW.id, 'Zaměstnanec vytvořen', jsonb_build_object(
    'first_name', NEW.first_name,
    'last_name', NEW.last_name
  ), NEW.created_by);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rozšíření výpočtu úkolové položky o m² a den
CREATE OR REPLACE FUNCTION calculate_task_line_earnings(
  p_unit_type price_unit_type,
  p_price NUMERIC,
  p_quantity NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
  CASE p_unit_type
    WHEN 'metr' THEN RETURN COALESCE(p_quantity, 0) * p_price;
    WHEN 'm2' THEN RETURN COALESCE(p_quantity, 0) * p_price;
    WHEN 'den' THEN RETURN COALESCE(p_quantity, 0) * p_price;
    WHEN 'kus' THEN RETURN COALESCE(p_quantity, 0) * p_price;
    WHEN 'pausal' THEN
      RETURN CASE WHEN COALESCE(p_quantity, 0) > 0 THEN p_price * p_quantity ELSE 0 END;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_worker_earnings(
  p_unit_type price_unit_type,
  p_price NUMERIC,
  p_hours NUMERIC,
  p_meters NUMERIC,
  p_pieces NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
  CASE p_unit_type
    WHEN 'hodina' THEN RETURN COALESCE(p_hours, 0) * p_price;
    WHEN 'metr' THEN RETURN COALESCE(p_meters, 0) * p_price;
    WHEN 'm2' THEN RETURN COALESCE(p_meters, 0) * p_price;
    WHEN 'den' THEN RETURN COALESCE(p_pieces, 0) * p_price;
    WHEN 'kus' THEN RETURN COALESCE(p_pieces, 0) * p_price;
    WHEN 'pausal' THEN RETURN p_price;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_form_earnings(p_form_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_hourly_item worker_price_items%ROWTYPE;
  v_total NUMERIC := 0;
  v_task_sum NUMERIC := 0;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO v_hourly_item FROM worker_price_items
  WHERE worker_id = v_form.worker_id
    AND name = 'Hodinová sazba'
    AND is_active = true
  LIMIT 1;

  IF v_form.work_type IN ('hodinova', 'kombinovana') THEN
    IF v_hourly_item.id IS NOT NULL THEN
      v_total := v_total + (COALESCE(v_form.hours, 0) * v_hourly_item.price);
    END IF;
  END IF;

  IF v_form.work_type IN ('ukolova', 'kombinovana') THEN
    SELECT COALESCE(SUM(line_earnings), 0) INTO v_task_sum
    FROM worker_form_task_items WHERE form_id = p_form_id;
    v_total := v_total + v_task_sum;
  END IF;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION save_form_task_items(
  p_form_id UUID,
  p_worker_id UUID,
  p_task_items JSONB
) RETURNS VOID AS $$
DECLARE
  v_item JSONB;
  v_price_item worker_price_items%ROWTYPE;
  v_quantity NUMERIC;
  v_earnings NUMERIC;
  v_sort INTEGER := 0;
BEGIN
  DELETE FROM worker_form_task_items WHERE form_id = p_form_id;

  IF p_task_items IS NULL OR jsonb_array_length(p_task_items) = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_task_items)
  LOOP
    v_sort := v_sort + 1;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    SELECT * INTO v_price_item FROM worker_price_items
    WHERE id = (v_item->>'price_item_id')::UUID
      AND worker_id = p_worker_id
      AND is_active = true
      AND name <> 'Hodinová sazba';

    IF NOT FOUND THEN CONTINUE; END IF;

    v_earnings := calculate_task_line_earnings(v_price_item.unit_type, v_price_item.price, v_quantity);

    INSERT INTO worker_form_task_items (form_id, price_item_id, quantity, line_earnings, sort_order)
    VALUES (p_form_id, v_price_item.id, v_quantity, v_earnings, v_sort);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION derive_form_totals(p_form_id UUID)
RETURNS TABLE (total_meters NUMERIC, total_pieces NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN pi.unit_type IN ('metr', 'm2') THEN ti.quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pi.unit_type IN ('kus', 'pausal', 'den') THEN ti.quantity ELSE 0 END), 0)
  FROM worker_form_task_items ti
  JOIN worker_price_items pi ON pi.id = ti.price_item_id
  WHERE ti.form_id = p_form_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION portal_get_price_items(p_token UUID)
RETURNS SETOF worker_price_items AS $$
  SELECT pi.*
  FROM worker_price_items pi
  JOIN workers w ON w.id = pi.worker_id
  WHERE w.portal_token = p_token
    AND w.status = 'aktivni'
    AND pi.is_active = true
  ORDER BY pi.sort_order;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION reorder_worker_price_items(
  p_worker_id UUID,
  p_item_ids UUID[]
) RETURNS VOID AS $$
DECLARE
  v_id UUID;
  v_order INTEGER := 0;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  FOREACH v_id IN ARRAY p_item_ids
  LOOP
    v_order := v_order + 1;
    UPDATE worker_price_items
    SET sort_order = v_order
    WHERE id = v_id AND worker_id = p_worker_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reorder_worker_price_items(UUID, UUID[]) TO authenticated;


-- =============================================================================
-- MIGRATION: 008_module4_formular.sql
-- =============================================================================

-- Modul 4 – Formulář zaměstnance (denní výkaz)
-- Spusťte po 007_module3_osobni_cenik.sql

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS assigned_order TEXT NOT NULL DEFAULT '';

ALTER TABLE worker_daily_forms
  ADD COLUMN IF NOT EXISTS work_start TIME,
  ADD COLUMN IF NOT EXISTS work_end TIME,
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gps_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS gps_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS gps_accuracy NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS signature_data TEXT;

ALTER TABLE worker_attendance_records
  ADD COLUMN IF NOT EXISTS work_start TIME,
  ADD COLUMN IF NOT EXISTS work_end TIME,
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE worker_reports
  ADD COLUMN IF NOT EXISTS material TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION calc_work_hours(
  p_start TIME,
  p_end TIME,
  p_break_minutes INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  v_minutes NUMERIC;
BEGIN
  IF p_start IS NULL OR p_end IS NULL THEN
    RETURN 0;
  END IF;

  v_minutes := EXTRACT(EPOCH FROM (p_end - p_start)) / 60;
  IF v_minutes < 0 THEN
    v_minutes := v_minutes + 24 * 60;
  END IF;

  RETURN GREATEST(0, ROUND((v_minutes - COALESCE(p_break_minutes, 0)) / 60.0, 2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP FUNCTION IF EXISTS public.portal_get_worker(uuid) CASCADE;

CREATE OR REPLACE FUNCTION portal_get_worker(p_token UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  "position" TEXT,
  status worker_status,
  employment_type employment_type,
  assigned_order TEXT
) AS $$
  SELECT
    w.id,
    w.first_name,
    w.last_name,
    w."position",
    w.status,
    w.employment_type,
    COALESCE(w.assigned_order, '')
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION portal_get_daily_advances(p_token UUID)
RETURNS TABLE (
  form_date DATE,
  advance NUMERIC,
  earnings NUMERIC,
  status worker_form_status
) AS $$
  SELECT f.form_date, f.advance, f.earnings, f.status
  FROM worker_daily_forms f
  JOIN workers w ON w.id = f.worker_id
  WHERE w.portal_token = p_token
    AND w.status = 'aktivni'
    AND f.advance > 0
    AND f.status IN ('odeslany', 'schvaleny')
  ORDER BY f.form_date DESC
  LIMIT 30;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION save_form_task_items(
  p_form_id UUID,
  p_worker_id UUID,
  p_task_items JSONB
) RETURNS VOID AS $$
DECLARE
  v_item JSONB;
  v_price_item worker_price_items%ROWTYPE;
  v_quantity NUMERIC;
  v_earnings NUMERIC;
  v_sort INTEGER := 0;
BEGIN
  DELETE FROM worker_form_task_items WHERE form_id = p_form_id;

  IF p_task_items IS NULL OR jsonb_array_length(p_task_items) = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_task_items)
  LOOP
    v_sort := v_sort + 1;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    SELECT * INTO v_price_item FROM worker_price_items
    WHERE id = (v_item->>'price_item_id')::UUID
      AND worker_id = p_worker_id
      AND is_active = true;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_earnings := calculate_task_line_earnings(v_price_item.unit_type, v_price_item.price, v_quantity);

    INSERT INTO worker_form_task_items (form_id, price_item_id, quantity, line_earnings, sort_order)
    VALUES (p_form_id, v_price_item.id, v_quantity, v_earnings, v_sort);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS portal_save_form(UUID, UUID, DATE, TEXT, work_type, TEXT, NUMERIC, NUMERIC, TEXT, JSONB);

CREATE OR REPLACE FUNCTION portal_save_form(
  p_token UUID,
  p_form_id UUID,
  p_form_date DATE,
  p_work_start TIME,
  p_work_end TIME,
  p_break_minutes INTEGER,
  p_advance NUMERIC,
  p_material TEXT,
  p_note TEXT,
  p_gps_lat NUMERIC,
  p_gps_lng NUMERIC,
  p_gps_accuracy NUMERIC,
  p_signature_data TEXT,
  p_task_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_worker_id UUID;
  v_order_name TEXT;
  v_form_id UUID;
  v_hours NUMERIC;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  SELECT w.id, COALESCE(w.assigned_order, '')
  INTO v_worker_id, v_order_name
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Neplatný přístup';
  END IF;

  IF p_form_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM worker_daily_forms
      WHERE id = p_form_id AND worker_id = v_worker_id AND status IN ('koncept', 'k_oprave')
    ) THEN
      RAISE EXCEPTION 'Formulář nelze upravovat';
    END IF;
  END IF;

  v_hours := calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0));

  IF p_form_id IS NULL THEN
    INSERT INTO worker_daily_forms (
      worker_id, form_date, order_name, activity, work_type, work_description,
      work_start, work_end, break_minutes, hours, meters, pieces,
      advance, material, note, gps_lat, gps_lng, gps_accuracy, signature_data, earnings
    )
    VALUES (
      v_worker_id, p_form_date, v_order_name, '', 'ukolova', '',
      p_work_start, p_work_end, COALESCE(p_break_minutes, 0), v_hours, 0, 0,
      COALESCE(p_advance, 0), COALESCE(p_material, ''), p_note,
      p_gps_lat, p_gps_lng, p_gps_accuracy, p_signature_data, 0
    )
    RETURNING id INTO v_form_id;
  ELSE
    UPDATE worker_daily_forms SET
      form_date = p_form_date,
      order_name = v_order_name,
      work_type = 'ukolova',
      work_description = '',
      work_start = p_work_start,
      work_end = p_work_end,
      break_minutes = COALESCE(p_break_minutes, 0),
      hours = v_hours,
      advance = COALESCE(p_advance, 0),
      material = COALESCE(p_material, ''),
      note = p_note,
      gps_lat = p_gps_lat,
      gps_lng = p_gps_lng,
      gps_accuracy = p_gps_accuracy,
      signature_data = p_signature_data,
      price_item_id = NULL
    WHERE id = p_form_id AND worker_id = v_worker_id
    RETURNING id INTO v_form_id;
  END IF;

  PERFORM save_form_task_items(v_form_id, v_worker_id, p_task_items);

  v_earnings := calculate_form_earnings(v_form_id);
  v_activity := derive_form_activity('ukolova', '', v_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(v_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces
  WHERE id = v_form_id;

  RETURN v_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS admin_save_form(UUID, DATE, TEXT, work_type, TEXT, NUMERIC, NUMERIC, TEXT, JSONB);

CREATE OR REPLACE FUNCTION admin_save_form(
  p_form_id UUID,
  p_form_date DATE,
  p_order_name TEXT,
  p_work_type work_type,
  p_work_description TEXT,
  p_work_start TIME,
  p_work_end TIME,
  p_break_minutes INTEGER,
  p_advance NUMERIC,
  p_material TEXT,
  p_note TEXT,
  p_gps_lat NUMERIC,
  p_gps_lng NUMERIC,
  p_gps_accuracy NUMERIC,
  p_signature_data TEXT,
  p_task_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_worker_id UUID;
  v_hours NUMERIC;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT worker_id INTO v_worker_id FROM worker_daily_forms WHERE id = p_form_id;
  IF v_worker_id IS NULL THEN RAISE EXCEPTION 'Formulář nenalezen'; END IF;

  v_hours := calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0));

  UPDATE worker_daily_forms SET
    form_date = p_form_date,
    order_name = p_order_name,
    work_type = p_work_type,
    work_description = COALESCE(p_work_description, ''),
    work_start = p_work_start,
    work_end = p_work_end,
    break_minutes = COALESCE(p_break_minutes, 0),
    hours = v_hours,
    advance = p_advance,
    material = COALESCE(p_material, ''),
    note = p_note,
    gps_lat = p_gps_lat,
    gps_lng = p_gps_lng,
    gps_accuracy = p_gps_accuracy,
    signature_data = p_signature_data
  WHERE id = p_form_id;

  IF p_work_type IN ('ukolova', 'kombinovana') THEN
    PERFORM save_form_task_items(p_form_id, v_worker_id, p_task_items);
  ELSE
    DELETE FROM worker_form_task_items WHERE form_id = p_form_id;
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(p_work_type, p_work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces
  WHERE id = p_form_id;

  RETURN p_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION submit_worker_daily_form(p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id FOR UPDATE;

  IF v_form.status NOT IN ('koncept', 'k_oprave') THEN
    RAISE EXCEPTION 'Formulář nelze odeslat v aktuálním stavu';
  END IF;

  IF v_form.signature_data IS NULL OR v_form.signature_data = '' THEN
    RAISE EXCEPTION 'Formulář vyžaduje podpis zaměstnance';
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(v_form.work_type, v_form.work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces,
    status = 'odeslany',
    submitted_at = now()
  WHERE id = p_form_id;

  IF EXISTS (SELECT 1 FROM worker_reports WHERE form_id = p_form_id) THEN
    UPDATE worker_reports SET
      report_date = v_form.form_date,
      order_name = v_form.order_name,
      activity = v_activity,
      hours = v_form.hours,
      meters = v_meters,
      pieces = v_pieces,
      earnings = v_earnings,
      material = COALESCE(v_form.material, ''),
      status = 'cekajici'
    WHERE form_id = p_form_id;
  ELSE
    INSERT INTO worker_reports (
      worker_id, form_id, report_date, order_name, activity,
      hours, meters, pieces, earnings, material, status
    )
    VALUES (
      v_form.worker_id, p_form_id, v_form.form_date, v_form.order_name, v_activity,
      v_form.hours, v_meters, v_pieces, v_earnings, COALESCE(v_form.material, ''), 'cekajici'
    );
  END IF;

  INSERT INTO worker_attendance_records (
    worker_id, form_id, attendance_date, hours, work_start, work_end, break_minutes
  )
  VALUES (
    v_form.worker_id, p_form_id, v_form.form_date, v_form.hours,
    v_form.work_start, v_form.work_end, COALESCE(v_form.break_minutes, 0)
  )
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET
    hours = worker_attendance_records.hours + EXCLUDED.hours,
    form_id = EXCLUDED.form_id,
    work_start = EXCLUDED.work_start,
    work_end = EXCLUDED.work_end,
    break_minutes = EXCLUDED.break_minutes;

  INSERT INTO worker_statistics (worker_id, stat_date, earnings, hours, meters, orders_count, advances)
  VALUES (v_form.worker_id, v_form.form_date, v_earnings, v_form.hours, v_meters, 1, v_form.advance)
  ON CONFLICT (worker_id, stat_date)
  DO UPDATE SET
    earnings = worker_statistics.earnings + EXCLUDED.earnings,
    hours = worker_statistics.hours + EXCLUDED.hours,
    meters = worker_statistics.meters + EXCLUDED.meters,
    orders_count = worker_statistics.orders_count + 1,
    advances = worker_statistics.advances + EXCLUDED.advances;

  INSERT INTO worker_history (worker_id, action, details)
  VALUES (v_form.worker_id, 'Denní formulář odeslán', jsonb_build_object(
    'form_id', p_form_id,
    'form_date', v_form.form_date,
    'order_name', v_form.order_name,
    'earnings', v_earnings,
    'advance', v_form.advance,
    'hours', v_form.hours,
    'material', v_form.material,
    'gps_lat', v_form.gps_lat,
    'gps_lng', v_form.gps_lng
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION portal_get_daily_advances(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calc_work_hours(TIME, TIME, INTEGER) TO anon, authenticated;


-- =============================================================================
-- MIGRATION: 009_module5_dochazka_vykazy.sql
-- =============================================================================

-- Modul 5 – Docházka zaměstnanců a denní výkazy
-- Spusťte po 008_module4_formular.sql

ALTER TABLE worker_attendance_records
  ADD COLUMN IF NOT EXISTS order_name TEXT NOT NULL DEFAULT '';

ALTER TABLE worker_reports
  ADD COLUMN IF NOT EXISTS advance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Docházka: doplnění zakázky u existujících záznamů z formuláře
UPDATE worker_attendance_records a
SET order_name = COALESCE(f.order_name, '')
FROM worker_daily_forms f
WHERE f.id = a.form_id AND (a.order_name IS NULL OR a.order_name = '');

CREATE OR REPLACE FUNCTION submit_worker_daily_form(p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id FOR UPDATE;

  IF v_form.status NOT IN ('koncept', 'k_oprave') THEN
    RAISE EXCEPTION 'Formulář nelze odeslat v aktuálním stavu';
  END IF;

  IF v_form.signature_data IS NULL OR v_form.signature_data = '' THEN
    RAISE EXCEPTION 'Formulář vyžaduje podpis zaměstnance';
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(v_form.work_type, v_form.work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces,
    status = 'odeslany',
    submitted_at = now()
  WHERE id = p_form_id;

  IF EXISTS (SELECT 1 FROM worker_reports WHERE form_id = p_form_id) THEN
    UPDATE worker_reports SET
      report_date = v_form.form_date,
      order_name = v_form.order_name,
      activity = v_activity,
      hours = v_form.hours,
      meters = v_meters,
      pieces = v_pieces,
      earnings = v_earnings,
      material = COALESCE(v_form.material, ''),
      advance = COALESCE(v_form.advance, 0),
      note = v_form.note,
      status = 'cekajici'
    WHERE form_id = p_form_id;
  ELSE
    INSERT INTO worker_reports (
      worker_id, form_id, report_date, order_name, activity,
      hours, meters, pieces, earnings, material, advance, note, status
    )
    VALUES (
      v_form.worker_id, p_form_id, v_form.form_date, v_form.order_name, v_activity,
      v_form.hours, v_meters, v_pieces, v_earnings,
      COALESCE(v_form.material, ''), COALESCE(v_form.advance, 0), v_form.note, 'cekajici'
    );
  END IF;

  INSERT INTO worker_attendance_records (
    worker_id, form_id, attendance_date, order_name, hours, work_start, work_end, break_minutes
  )
  VALUES (
    v_form.worker_id, p_form_id, v_form.form_date, v_form.order_name, v_form.hours,
    v_form.work_start, v_form.work_end, COALESCE(v_form.break_minutes, 0)
  )
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET
    hours = EXCLUDED.hours,
    form_id = EXCLUDED.form_id,
    order_name = EXCLUDED.order_name,
    work_start = EXCLUDED.work_start,
    work_end = EXCLUDED.work_end,
    break_minutes = EXCLUDED.break_minutes;

  INSERT INTO worker_statistics (worker_id, stat_date, earnings, hours, meters, orders_count, advances)
  VALUES (v_form.worker_id, v_form.form_date, v_earnings, v_form.hours, v_meters, 1, v_form.advance)
  ON CONFLICT (worker_id, stat_date)
  DO UPDATE SET
    earnings = worker_statistics.earnings + EXCLUDED.earnings,
    hours = worker_statistics.hours + EXCLUDED.hours,
    meters = worker_statistics.meters + EXCLUDED.meters,
    orders_count = worker_statistics.orders_count + 1,
    advances = worker_statistics.advances + EXCLUDED.advances;

  INSERT INTO worker_history (worker_id, action, details)
  VALUES (v_form.worker_id, 'Denní výkaz vytvořen', jsonb_build_object(
    'form_id', p_form_id,
    'form_date', v_form.form_date,
    'order_name', v_form.order_name,
    'earnings', v_earnings,
    'advance', v_form.advance,
    'hours', v_form.hours,
    'material', v_form.material,
    'gps_lat', v_form.gps_lat,
    'gps_lng', v_form.gps_lng
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_save_form(
  p_form_id UUID,
  p_form_date DATE,
  p_order_name TEXT,
  p_work_type work_type,
  p_work_description TEXT,
  p_work_start TIME,
  p_work_end TIME,
  p_break_minutes INTEGER,
  p_advance NUMERIC,
  p_material TEXT,
  p_note TEXT,
  p_gps_lat NUMERIC,
  p_gps_lng NUMERIC,
  p_gps_accuracy NUMERIC,
  p_signature_data TEXT,
  p_task_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_worker_id UUID;
  v_hours NUMERIC;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT worker_id INTO v_worker_id FROM worker_daily_forms WHERE id = p_form_id;
  IF v_worker_id IS NULL THEN RAISE EXCEPTION 'Formulář nenalezen'; END IF;

  v_hours := calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0));

  UPDATE worker_daily_forms SET
    form_date = p_form_date,
    order_name = p_order_name,
    work_type = p_work_type,
    work_description = COALESCE(p_work_description, ''),
    work_start = p_work_start,
    work_end = p_work_end,
    break_minutes = COALESCE(p_break_minutes, 0),
    hours = v_hours,
    advance = p_advance,
    material = COALESCE(p_material, ''),
    note = p_note,
    gps_lat = p_gps_lat,
    gps_lng = p_gps_lng,
    gps_accuracy = p_gps_accuracy,
    signature_data = p_signature_data
  WHERE id = p_form_id;

  IF p_work_type IN ('ukolova', 'kombinovana') THEN
    PERFORM save_form_task_items(p_form_id, v_worker_id, p_task_items);
  ELSE
    DELETE FROM worker_form_task_items WHERE form_id = p_form_id;
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(p_work_type, p_work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces
  WHERE id = p_form_id;

  UPDATE worker_reports SET
    report_date = p_form_date,
    order_name = p_order_name,
    activity = v_activity,
    hours = v_hours,
    meters = v_meters,
    pieces = v_pieces,
    earnings = v_earnings,
    material = COALESCE(p_material, ''),
    advance = COALESCE(p_advance, 0),
    note = p_note
  WHERE form_id = p_form_id;

  UPDATE worker_attendance_records SET
    attendance_date = p_form_date,
    order_name = p_order_name,
    hours = v_hours,
    work_start = p_work_start,
    work_end = p_work_end,
    break_minutes = COALESCE(p_break_minutes, 0)
  WHERE form_id = p_form_id;

  RETURN p_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION portal_get_attendance(p_token UUID)
RETURNS TABLE (
  id UUID,
  attendance_date DATE,
  order_name TEXT,
  work_start TIME,
  work_end TIME,
  break_minutes INTEGER,
  hours NUMERIC
) AS $$
  SELECT
    a.id,
    a.attendance_date,
    COALESCE(NULLIF(a.order_name, ''), f.order_name, ''),
    a.work_start,
    a.work_end,
    a.break_minutes,
    a.hours
  FROM worker_attendance_records a
  JOIN workers w ON w.id = a.worker_id
  LEFT JOIN worker_daily_forms f ON f.id = a.form_id
  WHERE w.portal_token = p_token AND w.status = 'aktivni'
  ORDER BY a.attendance_date DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_report_detail(p_report_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF get_user_role() NOT IN ('administrator', 'vedouci') THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT jsonb_build_object(
    'report', to_jsonb(r.*),
    'form', CASE WHEN f.id IS NOT NULL THEN to_jsonb(f.*) ELSE NULL END,
    'worker', jsonb_build_object(
      'first_name', w.first_name,
      'last_name', w.last_name,
      'position', w."position"
    ),
    'task_items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ti.id,
          'price_item_id', ti.price_item_id,
          'name', pi.name,
          'unit_type', pi.unit_type,
          'price', pi.price,
          'quantity', ti.quantity,
          'line_earnings', ti.line_earnings,
          'sort_order', ti.sort_order
        ) ORDER BY ti.sort_order
      )
      FROM worker_form_task_items ti
      JOIN worker_price_items pi ON pi.id = ti.price_item_id
      WHERE ti.form_id = f.id
    ), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at)
      FROM worker_form_photos p
      WHERE p.form_id = f.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM worker_reports r
  JOIN workers w ON w.id = r.worker_id
  LEFT JOIN worker_daily_forms f ON f.id = r.form_id
  WHERE r.id = p_report_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Výkaz nenalezen';
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION portal_get_report_detail(p_token UUID, p_report_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_worker_id UUID;
  v_result JSONB;
BEGIN
  SELECT w.id INTO v_worker_id
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Neplatný přístup';
  END IF;

  SELECT jsonb_build_object(
    'report', to_jsonb(r.*),
    'form', CASE WHEN f.id IS NOT NULL THEN to_jsonb(f.*) ELSE NULL END,
    'worker', jsonb_build_object(
      'first_name', w.first_name,
      'last_name', w.last_name,
      'position', w."position"
    ),
    'task_items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ti.id,
          'price_item_id', ti.price_item_id,
          'name', pi.name,
          'unit_type', pi.unit_type,
          'price', pi.price,
          'quantity', ti.quantity,
          'line_earnings', ti.line_earnings,
          'sort_order', ti.sort_order
        ) ORDER BY ti.sort_order
      )
      FROM worker_form_task_items ti
      JOIN worker_price_items pi ON pi.id = ti.price_item_id
      WHERE ti.form_id = f.id
    ), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at)
      FROM worker_form_photos p
      WHERE p.form_id = f.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM worker_reports r
  JOIN workers w ON w.id = r.worker_id
  LEFT JOIN worker_daily_forms f ON f.id = r.form_id
  WHERE r.id = p_report_id AND r.worker_id = v_worker_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Výkaz nenalezen';
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION delete_daily_report(p_report_id UUID)
RETURNS VOID AS $$
DECLARE
  v_report worker_reports%ROWTYPE;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_report FROM worker_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Výkaz nenalezen'; END IF;

  DELETE FROM worker_reports WHERE id = p_report_id;

  INSERT INTO worker_history (worker_id, action, details)
  VALUES (v_report.worker_id, 'Denní výkaz smazán', jsonb_build_object(
    'report_id', p_report_id,
    'form_id', v_report.form_id
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION approve_daily_report(p_report_id UUID, p_approved_by UUID)
RETURNS VOID AS $$
DECLARE
  v_report worker_reports%ROWTYPE;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_report FROM worker_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Výkaz nenalezen'; END IF;

  UPDATE worker_reports SET status = 'schvaleny' WHERE id = p_report_id;

  IF v_report.form_id IS NOT NULL THEN
    UPDATE worker_daily_forms SET status = 'schvaleny', approved_by = p_approved_by
    WHERE id = v_report.form_id;
  END IF;

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (v_report.worker_id, 'Denní výkaz schválen', jsonb_build_object(
    'report_id', p_report_id,
    'form_id', v_report.form_id
  ), p_approved_by);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION return_daily_report(p_report_id UUID, p_performed_by UUID)
RETURNS VOID AS $$
DECLARE
  v_report worker_reports%ROWTYPE;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT * INTO v_report FROM worker_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Výkaz nenalezen'; END IF;

  UPDATE worker_reports SET status = 'k_oprave' WHERE id = p_report_id;

  IF v_report.form_id IS NOT NULL THEN
    UPDATE worker_daily_forms SET status = 'k_oprave' WHERE id = v_report.form_id;
  END IF;

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (v_report.worker_id, 'Denní výkaz vrácen k opravě', jsonb_build_object(
    'report_id', p_report_id,
    'form_id', v_report.form_id
  ), p_performed_by);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION portal_get_attendance(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_report_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION portal_get_report_detail(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_daily_report(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_daily_report(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION return_daily_report(UUID, UUID) TO authenticated;

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id IN ('dochazka', 'vykazy');


-- =============================================================================
-- MIGRATION: 010_module6_zakazky.sql
-- =============================================================================

-- Modul 6 – Zakázky
-- Spusťte po 009_module5_dochazka_vykazy.sql

CREATE TYPE job_order_status AS ENUM (
  'pripravuje_se',
  'aktivni',
  'pozastavena',
  'dokoncena',
  'archivovana'
);

CREATE TABLE job_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  work_description TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  order_number TEXT,
  investor TEXT,
  client_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  gps_lat NUMERIC(10, 7),
  gps_lng NUMERIC(10, 7),
  gps_accuracy NUMERIC(10, 2),
  note TEXT,
  status job_order_status NOT NULL DEFAULT 'pripravuje_se',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_orders_dates_check CHECK (end_date >= start_date)
);

CREATE TABLE job_order_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_orders_status ON job_orders(status);
CREATE INDEX idx_job_orders_name ON job_orders(name);
CREATE INDEX idx_job_orders_location ON job_orders(location);
CREATE INDEX idx_job_orders_dates ON job_orders(start_date, end_date);

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS assigned_order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL;

ALTER TABLE worker_daily_forms
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL;

ALTER TABLE worker_reports
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL;

ALTER TABLE worker_attendance_records
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL;

CREATE TRIGGER job_orders_updated_at
  BEFORE UPDATE ON job_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE job_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_order_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_order_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin a vedoucí čtou zakázky"
  ON job_orders FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje zakázky"
  ON job_orders FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin a vedoucí čtou dokumenty zakázky"
  ON job_order_documents FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje dokumenty zakázky"
  ON job_order_documents FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin a vedoucí čtou fotografie zakázky"
  ON job_order_photos FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje fotografie zakázky"
  ON job_order_photos FOR ALL
  USING (get_user_role() = 'administrator');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('order-photos', 'order-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('order-documents', 'order-documents', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin nahrává fotografie zakázky"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-photos');

CREATE POLICY "Veřejné čtení fotografií zakázky"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'order-photos');

CREATE POLICY "Admin nahrává PDF zakázky"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-documents');

CREATE POLICY "Autentizovaní čtou PDF zakázky"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'order-documents');

CREATE OR REPLACE FUNCTION portal_get_active_orders(p_token UUID)
RETURNS TABLE (id UUID, name TEXT, location TEXT) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workers w WHERE w.portal_token = p_token AND w.status = 'aktivni'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT jo.id, jo.name, jo.location
  FROM job_orders jo
  WHERE jo.status = 'aktivni'
  ORDER BY jo.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP FUNCTION IF EXISTS portal_save_form(UUID, UUID, DATE, TIME, TIME, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB);

CREATE OR REPLACE FUNCTION portal_save_form(
  p_token UUID,
  p_form_id UUID,
  p_form_date DATE,
  p_order_id UUID,
  p_work_start TIME,
  p_work_end TIME,
  p_break_minutes INTEGER,
  p_advance NUMERIC,
  p_material TEXT,
  p_note TEXT,
  p_gps_lat NUMERIC,
  p_gps_lng NUMERIC,
  p_gps_accuracy NUMERIC,
  p_signature_data TEXT,
  p_task_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_worker_id UUID;
  v_order_name TEXT;
  v_form_id UUID;
  v_hours NUMERIC;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  SELECT w.id INTO v_worker_id
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Neplatný přístup';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Vyberte aktivní zakázku';
  END IF;

  SELECT jo.name INTO v_order_name
  FROM job_orders jo
  WHERE jo.id = p_order_id AND jo.status = 'aktivni';

  IF v_order_name IS NULL THEN
    RAISE EXCEPTION 'Zakázka není aktivní nebo neexistuje';
  END IF;

  IF p_form_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM worker_daily_forms
      WHERE id = p_form_id AND worker_id = v_worker_id AND status IN ('koncept', 'k_oprave')
    ) THEN
      RAISE EXCEPTION 'Formulář nelze upravovat';
    END IF;
  END IF;

  v_hours := calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0));

  IF p_form_id IS NULL THEN
    INSERT INTO worker_daily_forms (
      worker_id, form_date, order_id, order_name, activity, work_type, work_description,
      work_start, work_end, break_minutes, hours, meters, pieces,
      advance, material, note, gps_lat, gps_lng, gps_accuracy, signature_data, earnings
    )
    VALUES (
      v_worker_id, p_form_date, p_order_id, v_order_name, '', 'ukolova', '',
      p_work_start, p_work_end, COALESCE(p_break_minutes, 0), v_hours, 0, 0,
      COALESCE(p_advance, 0), COALESCE(p_material, ''), p_note,
      p_gps_lat, p_gps_lng, p_gps_accuracy, p_signature_data, 0
    )
    RETURNING id INTO v_form_id;
  ELSE
    UPDATE worker_daily_forms SET
      form_date = p_form_date,
      order_id = p_order_id,
      order_name = v_order_name,
      work_type = 'ukolova',
      work_description = '',
      work_start = p_work_start,
      work_end = p_work_end,
      break_minutes = COALESCE(p_break_minutes, 0),
      hours = v_hours,
      advance = COALESCE(p_advance, 0),
      material = COALESCE(p_material, ''),
      note = p_note,
      gps_lat = p_gps_lat,
      gps_lng = p_gps_lng,
      gps_accuracy = p_gps_accuracy,
      signature_data = p_signature_data,
      price_item_id = NULL
    WHERE id = p_form_id AND worker_id = v_worker_id
    RETURNING id INTO v_form_id;
  END IF;

  PERFORM save_form_task_items(v_form_id, v_worker_id, p_task_items);

  v_earnings := calculate_form_earnings(v_form_id);
  v_activity := derive_form_activity('ukolova', '', v_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(v_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces
  WHERE id = v_form_id;

  RETURN v_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.portal_get_worker(uuid) CASCADE;

CREATE OR REPLACE FUNCTION portal_get_worker(p_token UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  "position" TEXT,
  status worker_status,
  employment_type employment_type,
  assigned_order TEXT,
  assigned_order_id UUID
) AS $$
  SELECT
    w.id,
    w.first_name,
    w.last_name,
    w."position",
    w.status,
    w.employment_type,
    COALESCE(jo.name, w.assigned_order, ''),
    w.assigned_order_id
  FROM workers w
  LEFT JOIN job_orders jo ON jo.id = w.assigned_order_id
  WHERE w.portal_token = p_token AND w.status = 'aktivni';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP FUNCTION IF EXISTS admin_save_form(UUID, DATE, TEXT, work_type, TEXT, TIME, TIME, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB);

CREATE OR REPLACE FUNCTION admin_save_form(
  p_form_id UUID,
  p_form_date DATE,
  p_order_id UUID,
  p_work_type work_type,
  p_work_description TEXT,
  p_work_start TIME,
  p_work_end TIME,
  p_break_minutes INTEGER,
  p_advance NUMERIC,
  p_material TEXT,
  p_note TEXT,
  p_gps_lat NUMERIC,
  p_gps_lng NUMERIC,
  p_gps_accuracy NUMERIC,
  p_signature_data TEXT,
  p_task_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_worker_id UUID;
  v_order_name TEXT;
  v_hours NUMERIC;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT worker_id INTO v_worker_id FROM worker_daily_forms WHERE id = p_form_id;
  IF v_worker_id IS NULL THEN RAISE EXCEPTION 'Formulář nenalezen'; END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT name INTO v_order_name FROM job_orders WHERE id = p_order_id;
  END IF;
  IF v_order_name IS NULL THEN
    SELECT order_name INTO v_order_name FROM worker_daily_forms WHERE id = p_form_id;
  END IF;

  v_hours := calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0));

  UPDATE worker_daily_forms SET
    form_date = p_form_date,
    order_id = p_order_id,
    order_name = COALESCE(v_order_name, ''),
    work_type = p_work_type,
    work_description = COALESCE(p_work_description, ''),
    work_start = p_work_start,
    work_end = p_work_end,
    break_minutes = COALESCE(p_break_minutes, 0),
    hours = v_hours,
    advance = p_advance,
    material = COALESCE(p_material, ''),
    note = p_note,
    gps_lat = p_gps_lat,
    gps_lng = p_gps_lng,
    gps_accuracy = p_gps_accuracy,
    signature_data = p_signature_data
  WHERE id = p_form_id;

  IF p_work_type IN ('ukolova', 'kombinovana') THEN
    PERFORM save_form_task_items(p_form_id, v_worker_id, p_task_items);
  ELSE
    DELETE FROM worker_form_task_items WHERE form_id = p_form_id;
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(p_work_type, p_work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces
  WHERE id = p_form_id;

  UPDATE worker_reports SET
    report_date = p_form_date,
    order_id = p_order_id,
    order_name = COALESCE(v_order_name, ''),
    activity = v_activity,
    hours = v_hours,
    meters = v_meters,
    pieces = v_pieces,
    earnings = v_earnings,
    material = COALESCE(p_material, ''),
    advance = COALESCE(p_advance, 0),
    note = p_note
  WHERE form_id = p_form_id;

  UPDATE worker_attendance_records SET
    attendance_date = p_form_date,
    order_id = p_order_id,
    order_name = COALESCE(v_order_name, ''),
    hours = v_hours,
    work_start = p_work_start,
    work_end = p_work_end,
    break_minutes = COALESCE(p_break_minutes, 0)
  WHERE form_id = p_form_id;

  RETURN p_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION submit_worker_daily_form(p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id FOR UPDATE;

  IF v_form.status NOT IN ('koncept', 'k_oprave') THEN
    RAISE EXCEPTION 'Formulář nelze odeslat v aktuálním stavu';
  END IF;

  IF v_form.signature_data IS NULL OR v_form.signature_data = '' THEN
    RAISE EXCEPTION 'Formulář vyžaduje podpis zaměstnance';
  END IF;

  IF v_form.order_id IS NULL THEN
    RAISE EXCEPTION 'Formulář vyžaduje aktivní zakázku';
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(v_form.work_type, v_form.work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces,
    status = 'odeslany',
    submitted_at = now()
  WHERE id = p_form_id;

  IF EXISTS (SELECT 1 FROM worker_reports WHERE form_id = p_form_id) THEN
    UPDATE worker_reports SET
      report_date = v_form.form_date,
      order_id = v_form.order_id,
      order_name = v_form.order_name,
      activity = v_activity,
      hours = v_form.hours,
      meters = v_meters,
      pieces = v_pieces,
      earnings = v_earnings,
      material = COALESCE(v_form.material, ''),
      advance = COALESCE(v_form.advance, 0),
      note = v_form.note,
      status = 'cekajici'
    WHERE form_id = p_form_id;
  ELSE
    INSERT INTO worker_reports (
      worker_id, form_id, report_date, order_id, order_name, activity,
      hours, meters, pieces, earnings, material, advance, note, status
    )
    VALUES (
      v_form.worker_id, p_form_id, v_form.form_date, v_form.order_id, v_form.order_name, v_activity,
      v_form.hours, v_meters, v_pieces, v_earnings,
      COALESCE(v_form.material, ''), COALESCE(v_form.advance, 0), v_form.note, 'cekajici'
    );
  END IF;

  INSERT INTO worker_attendance_records (
    worker_id, form_id, attendance_date, order_id, order_name, hours, work_start, work_end, break_minutes
  )
  VALUES (
    v_form.worker_id, p_form_id, v_form.form_date, v_form.order_id, v_form.order_name, v_form.hours,
    v_form.work_start, v_form.work_end, COALESCE(v_form.break_minutes, 0)
  )
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET
    hours = EXCLUDED.hours,
    form_id = EXCLUDED.form_id,
    order_id = EXCLUDED.order_id,
    order_name = EXCLUDED.order_name,
    work_start = EXCLUDED.work_start,
    work_end = EXCLUDED.work_end,
    break_minutes = EXCLUDED.break_minutes;

  INSERT INTO worker_statistics (worker_id, stat_date, earnings, hours, meters, orders_count, advances)
  VALUES (v_form.worker_id, v_form.form_date, v_earnings, v_form.hours, v_meters, 1, v_form.advance)
  ON CONFLICT (worker_id, stat_date)
  DO UPDATE SET
    earnings = worker_statistics.earnings + EXCLUDED.earnings,
    hours = worker_statistics.hours + EXCLUDED.hours,
    meters = worker_statistics.meters + EXCLUDED.meters,
    orders_count = worker_statistics.orders_count + 1,
    advances = worker_statistics.advances + EXCLUDED.advances;

  INSERT INTO worker_history (worker_id, action, details)
  VALUES (v_form.worker_id, 'Denní výkaz vytvořen', jsonb_build_object(
    'form_id', p_form_id,
    'order_id', v_form.order_id,
    'order_name', v_form.order_name,
    'form_date', v_form.form_date,
    'earnings', v_earnings,
    'advance', v_form.advance,
    'hours', v_form.hours
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_job_order_detail(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF get_user_role() NOT IN ('administrator', 'vedouci') THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT jsonb_build_object(
    'order', to_jsonb(jo.*),
    'documents', COALESCE((
      SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at DESC)
      FROM job_order_documents d WHERE d.order_id = jo.id
    ), '[]'::jsonb),
    'photos', COALESCE((
      SELECT jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at DESC)
      FROM job_order_photos p WHERE p.order_id = jo.id
    ), '[]'::jsonb),
    'employees', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object(
        'id', w.id,
        'first_name', w.first_name,
        'last_name', w.last_name,
        'position', w."position"
      ))
      FROM workers w
      WHERE w.assigned_order_id = jo.id
         OR w.id IN (SELECT DISTINCT f.worker_id FROM worker_daily_forms f WHERE f.order_id = jo.id)
    ), '[]'::jsonb),
    'attendance', COALESCE((
      SELECT jsonb_agg(to_jsonb(a.*) ORDER BY a.attendance_date DESC)
      FROM worker_attendance_records a WHERE a.order_id = jo.id
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(to_jsonb(r.*) ORDER BY r.report_date DESC)
      FROM worker_reports r WHERE r.order_id = jo.id
    ), '[]'::jsonb),
    'advances', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'form_date', f.form_date,
        'worker_id', f.worker_id,
        'worker_name', w.first_name || ' ' || w.last_name,
        'advance', f.advance,
        'earnings', f.earnings
      ) ORDER BY f.form_date DESC)
      FROM worker_daily_forms f
      JOIN workers w ON w.id = f.worker_id
      WHERE f.order_id = jo.id AND f.advance > 0
        AND f.status IN ('odeslany', 'schvaleny')
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM job_orders jo
  WHERE jo.id = p_order_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Zakázka nenalezena';
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION portal_get_active_orders(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_job_order_detail(UUID) TO authenticated;

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id = 'zakazky';


-- =============================================================================
-- MIGRATION: 011_module7_naklady.sql
-- =============================================================================

-- Modul 7 – Náklady
-- Spusťte po 010_module6_zakazky.sql

CREATE TABLE job_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_date DATE NOT NULL,
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  supplier TEXT,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_cost_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_id UUID NOT NULL REFERENCES job_costs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_cost_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_id UUID NOT NULL REFERENCES job_costs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_costs_date ON job_costs(cost_date);
CREATE INDEX idx_job_costs_order ON job_costs(order_id);
CREATE INDEX idx_job_costs_order_date ON job_costs(order_id, cost_date);

CREATE TRIGGER job_costs_updated_at
  BEFORE UPDATE ON job_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE job_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cost_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cost_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte náklady"
  ON job_costs FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje náklady"
  ON job_costs FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte doklady nákladů"
  ON job_cost_documents FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje doklady nákladů"
  ON job_cost_documents FOR ALL
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte fotografie nákladů"
  ON job_cost_photos FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje fotografie nákladů"
  ON job_cost_photos FOR ALL
  USING (get_user_role() = 'administrator');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('cost-photos', 'cost-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('cost-documents', 'cost-documents', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin nahrává fotografie nákladů"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cost-photos');

CREATE POLICY "Veřejné čtení fotografií nákladů"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'cost-photos');

CREATE POLICY "Admin nahrává PDF nákladů"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cost-documents');

CREATE POLICY "Autentizovaní čtou PDF nákladů"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cost-documents');

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id = 'ekonomika';


-- =============================================================================
-- MIGRATION: 012_automaticke_smlouvy.sql
-- =============================================================================

-- Automatické vyplnění pracovní smlouvy
-- Spusťte po 011_module7_naklady.sql

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS director_name TEXT NOT NULL DEFAULT '';


-- =============================================================================
-- MIGRATION: 013_module9_fotodokumentace.sql
-- =============================================================================

-- Modul 9 – Fotodokumentace s GPS
-- Spusťte po 012_automaticke_smlouvy.sql

CREATE TABLE gps_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_date DATE NOT NULL,
  captured_time TIME NOT NULL,
  gps_lat NUMERIC(10, 7) NOT NULL,
  gps_lng NUMERIC(10, 7) NOT NULL,
  gps_accuracy NUMERIC(10, 2),
  address_full TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  note TEXT,
  order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL,
  worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  report_id UUID REFERENCES worker_reports(id) ON DELETE SET NULL,
  diary_entry_id UUID,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gps_photo_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES gps_photos(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gps_photos_captured ON gps_photos(captured_date DESC, captured_time DESC);
CREATE INDEX idx_gps_photos_order ON gps_photos(order_id);
CREATE INDEX idx_gps_photos_worker ON gps_photos(worker_id);
CREATE INDEX idx_gps_photos_report ON gps_photos(report_id);

CREATE TRIGGER gps_photos_updated_at
  BEFORE UPDATE ON gps_photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE gps_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_photo_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ERP uživatelé čtou fotodokumentaci"
  ON gps_photos FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP uživatelé vytváří fotodokumentaci"
  ON gps_photos FOR INSERT
  WITH CHECK (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP uživatelé upravují fotodokumentaci"
  ON gps_photos FOR UPDATE
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "Admin maže fotodokumentaci"
  ON gps_photos FOR DELETE
  USING (get_user_role() = 'administrator');

CREATE POLICY "ERP uživatelé čtou historii fotek"
  ON gps_photo_history FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP uživatelé zapisují historii fotek"
  ON gps_photo_history FOR INSERT
  WITH CHECK (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('gps-photos', 'gps-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autentizovaní nahrávají GPS fotografie"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gps-photos');

CREATE POLICY "Veřejné čtení GPS fotografií"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'gps-photos');

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0', label = 'Fotodokumentace' WHERE id = 'fotky';


-- =============================================================================
-- MIGRATION: 014_module10_stavebni_denik.sql
-- =============================================================================

-- Modul 10 – Stavební deník
-- Spusťte po 013_module9_fotodokumentace.sql

CREATE TABLE construction_diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  weather TEXT NOT NULL,
  worker_count INTEGER NOT NULL CHECK (worker_count >= 0),
  worker_names TEXT NOT NULL,
  equipment TEXT NOT NULL,
  work_description TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diary_entries_date ON construction_diary_entries(entry_date DESC);
CREATE INDEX idx_diary_entries_order ON construction_diary_entries(order_id);
CREATE INDEX idx_gps_photos_diary ON gps_photos(diary_entry_id);

ALTER TABLE gps_photos
  ADD CONSTRAINT gps_photos_diary_entry_id_fkey
  FOREIGN KEY (diary_entry_id) REFERENCES construction_diary_entries(id) ON DELETE CASCADE;

CREATE TRIGGER construction_diary_entries_updated_at
  BEFORE UPDATE ON construction_diary_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE construction_diary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ERP uživatelé čtou stavební deník"
  ON construction_diary_entries FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "Admin vytváří zápisy deníku"
  ON construction_diary_entries FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje zápisy deníku"
  ON construction_diary_entries FOR UPDATE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin maže zápisy deníku"
  ON construction_diary_entries FOR DELETE
  USING (get_user_role() = 'administrator');

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0', label = 'Stavební deník' WHERE id = 'denik';


-- =============================================================================
-- MIGRATION: 015_module11_pripojky.sql
-- =============================================================================

-- Modul 11 – Přípojky
-- Spusťte po 014_module10_stavebni_denik.sql

CREATE TYPE utility_connection_work_type AS ENUM ('pripojka', 'jina');
CREATE TYPE utility_connection_photo_phase AS ENUM ('pred', 'po');

CREATE TABLE utility_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_date DATE NOT NULL,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  connection_address TEXT NOT NULL,
  work_description TEXT NOT NULL,
  length_meters NUMERIC(10, 2) NOT NULL CHECK (length_meters >= 0),
  penetration_count INTEGER NOT NULL CHECK (penetration_count >= 0),
  work_type utility_connection_work_type NOT NULL DEFAULT 'pripojka',
  diary_entry_id UUID REFERENCES construction_diary_entries(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gps_photos
  ADD COLUMN IF NOT EXISTS utility_connection_id UUID REFERENCES utility_connections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS photo_phase utility_connection_photo_phase;

CREATE INDEX idx_utility_connections_date ON utility_connections(connection_date DESC);
CREATE INDEX idx_utility_connections_order ON utility_connections(order_id);
CREATE INDEX idx_utility_connections_worker ON utility_connections(worker_id);
CREATE INDEX idx_gps_photos_connection ON gps_photos(utility_connection_id);

CREATE TRIGGER utility_connections_updated_at
  BEFORE UPDATE ON utility_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE utility_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin a vedoucí čtou přípojky"
  ON utility_connections FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje přípojky"
  ON utility_connections FOR ALL
  USING (get_user_role() = 'administrator');

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id = 'pripojky';


-- =============================================================================
-- MIGRATION: 016_module12_vyplatni_pasky.sql
-- =============================================================================

-- Modul 12 – Výplatní pásky
-- Spusťte po 015_module11_pripojky.sql
-- Výplatní pásky vycházejí ze schválených worker_reports (bez duplicitních dat)

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES ('vyplatni-pasky', 'Výplatní pásky', '/vyplatni-pasky', 'Wallet', 6, true, '1.0.0')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  is_implemented = true,
  module_version = EXCLUDED.module_version;

COMMENT ON TABLE payroll IS 'Zastaralé – nepoužívat. Výplatní pásky generuje modul vyplatni-pasky ze schválených výkazů (worker_reports).';

-- Přehled výplat – pouze administrátor (agregace ze schválených výkazů)
CREATE OR REPLACE FUNCTION get_payroll_slip_summaries(
  p_date_from DATE,
  p_date_to DATE,
  p_worker_id UUID DEFAULT NULL
)
RETURNS TABLE (
  worker_id UUID,
  worker_first_name TEXT,
  worker_last_name TEXT,
  report_count BIGINT,
  total_earnings NUMERIC,
  total_advances NUMERIC,
  net_amount NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Přístup pouze pro administrátora';
  END IF;

  RETURN QUERY
  SELECT
    w.id AS worker_id,
    w.first_name AS worker_first_name,
    w.last_name AS worker_last_name,
    COUNT(r.id) AS report_count,
    COALESCE(SUM(r.earnings), 0) AS total_earnings,
    COALESCE(SUM(r.advance), 0) AS total_advances,
    COALESCE(SUM(r.earnings), 0) - COALESCE(SUM(r.advance), 0) AS net_amount
  FROM workers w
  INNER JOIN worker_reports r ON r.worker_id = w.id
  WHERE r.status = 'schvaleny'
    AND r.report_date >= p_date_from
    AND r.report_date <= p_date_to
    AND (p_worker_id IS NULL OR w.id = p_worker_id)
  GROUP BY w.id, w.first_name, w.last_name
  HAVING COUNT(r.id) > 0
  ORDER BY w.last_name, w.first_name;
END;
$$;

REVOKE ALL ON FUNCTION get_payroll_slip_summaries(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_payroll_slip_summaries(DATE, DATE, UUID) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_worker_reports_payroll
  ON worker_reports(worker_id, report_date DESC)
  WHERE status = 'schvaleny';


-- =============================================================================
-- MIGRATION: 017_admin_accounts.sql
-- =============================================================================

-- Modul 13 – Administrátorské účty a první spuštění
-- Spusťte po 016_module12_vyplatni_pasky.sql
-- Hesla se ukládají šifrovaně v auth.users (bcrypt). Nikdy neukládejte hesla do zdrojového kódu.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- První uživatel = administrátor
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'administrator' AND is_active = true
  ) THEN
    v_role := 'administrator';
  ELSE
    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'delnik');
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    v_role
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Synchronizace e-mailu profilu po změně v auth
CREATE OR REPLACE FUNCTION sync_profile_email_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_profile_email_from_auth();

-- Blokace veřejné registrace po vytvoření prvního administrátora
CREATE OR REPLACE FUNCTION guard_auth_user_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'administrator' AND is_active = true
  ) AND get_user_role() IS DISTINCT FROM 'administrator' THEN
    RAISE EXCEPTION 'Vytváření účtů je povoleno pouze administrátorovi systému.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_auth_user_insert_trigger ON auth.users;
CREATE TRIGGER guard_auth_user_insert_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION guard_auth_user_insert();

CREATE OR REPLACE FUNCTION internal_create_auth_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role user_role
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Neplatný e-mail';
  END IF;

  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'Heslo musí mít alespoň 8 znaků';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Uživatel s tímto e-mailem již existuje';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name, 'role', p_role::text),
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    email,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_email,
    v_email,
    now(),
    now(),
    now()
  );

  UPDATE public.profiles
  SET role = p_role, full_name = p_full_name, email = v_email, updated_at = now()
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION internal_create_auth_user(TEXT, TEXT, TEXT, user_role) FROM PUBLIC;

CREATE OR REPLACE FUNCTION system_needs_bootstrap()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles WHERE role = 'administrator' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION bootstrap_first_admin(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_full_name TEXT := COALESCE(NULLIF(TRIM(p_full_name), ''), split_part(lower(trim(p_email)), '@', 1));
  v_user_id UUID;
BEGIN
  IF NOT system_needs_bootstrap() THEN
    RAISE EXCEPTION 'Administrátor již existuje';
  END IF;

  v_user_id := internal_create_auth_user(p_email, p_password, v_full_name, 'administrator');
  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role user_role DEFAULT 'administrator'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_full_name TEXT := COALESCE(NULLIF(TRIM(p_full_name), ''), split_part(lower(trim(p_email)), '@', 1));
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Přístup pouze pro administrátora';
  END IF;

  IF p_role NOT IN ('administrator', 'vedouci', 'delnik') THEN
    RAISE EXCEPTION 'Neplatná role';
  END IF;

  RETURN internal_create_auth_user(p_email, p_password, v_full_name, p_role);
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_user_active(p_user_id UUID, p_is_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_role user_role;
  v_admin_count INTEGER;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Přístup pouze pro administrátora';
  END IF;

  IF p_user_id = auth.uid() AND NOT p_is_active THEN
    RAISE EXCEPTION 'Nelze deaktivovat vlastní účet';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Uživatel nenalezen';
  END IF;

  IF NOT p_is_active AND v_role = 'administrator' THEN
    SELECT count(*) INTO v_admin_count
    FROM profiles
    WHERE role = 'administrator' AND is_active = true AND id <> p_user_id;

    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'Musí zůstat alespoň jeden aktivní administrátor';
    END IF;
  END IF;

  UPDATE profiles SET is_active = p_is_active, updated_at = now() WHERE id = p_user_id;

  IF p_is_active THEN
    UPDATE auth.users SET banned_until = NULL WHERE id = p_user_id;
  ELSE
    UPDATE auth.users SET banned_until = 'infinity'::timestamptz WHERE id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_revoke_administrator(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count INTEGER;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Přístup pouze pro administrátora';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Nelze odebrat administrátorská práva sám sobě';
  END IF;

  SELECT count(*) INTO v_admin_count
  FROM profiles
  WHERE role = 'administrator' AND is_active = true AND id <> p_user_id;

  IF v_admin_count = 0 THEN
    RAISE EXCEPTION 'Musí zůstat alespoň jeden aktivní administrátor';
  END IF;

  UPDATE profiles SET role = 'delnik', updated_at = now() WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION system_needs_bootstrap() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION bootstrap_first_admin(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_user(TEXT, TEXT, TEXT, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_revoke_administrator(UUID) TO authenticated;


-- =============================================================================
-- MIGRATION: 018_erp_security_lockdown.sql
-- =============================================================================

-- Zabezpečení ERP – neveřejný systém, přístup pouze administrátor
-- Portál zaměstnance zůstává dostupný přes jedinečný token (RPC funkce)

CREATE OR REPLACE FUNCTION resolve_portal_worker_id(p_token UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID;
BEGIN
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Neplatný odkaz';
  END IF;

  SELECT w.id INTO v_worker_id
  FROM workers w
  WHERE w.portal_token = p_token AND w.status = 'aktivni';

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Odkaz není platný nebo byl deaktivován';
  END IF;

  RETURN v_worker_id;
END;
$$;

REVOKE ALL ON FUNCTION resolve_portal_worker_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_portal_worker_id(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_regenerate_portal_token(p_worker_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token UUID := gen_random_uuid();
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Přístup pouze pro administrátora';
  END IF;

  UPDATE workers
  SET portal_token = v_new_token, updated_at = now()
  WHERE id = p_worker_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zaměstnanec nenalezen';
  END IF;

  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_regenerate_portal_token(UUID) TO authenticated;

-- ============================================================
-- RLS – ERP tabulky pouze pro administrátora
-- ============================================================

DROP POLICY IF EXISTS "Admin a vedoucí čtou zaměstnance" ON workers;
CREATE POLICY "Admin čte zaměstnance"
  ON workers FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou ceník" ON worker_price_items;
CREATE POLICY "Admin čte ceník"
  ON worker_price_items FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou dokumenty" ON worker_documents;
CREATE POLICY "Admin čte dokumenty zaměstnanců"
  ON worker_documents FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou formuláře" ON worker_daily_forms;
CREATE POLICY "Admin čte formuláře"
  ON worker_daily_forms FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou fotografie" ON worker_form_photos;
CREATE POLICY "Admin čte fotografie formulářů"
  ON worker_form_photos FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou výkazy" ON worker_reports;
CREATE POLICY "Admin čte výkazy"
  ON worker_reports FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou docházku" ON worker_attendance_records;
CREATE POLICY "Admin čte docházku"
  ON worker_attendance_records FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou historii" ON worker_history;
CREATE POLICY "Admin čte historii"
  ON worker_history FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou statistiky" ON worker_statistics;
CREATE POLICY "Admin čte statistiky"
  ON worker_statistics FOR SELECT
  USING (get_user_role() = 'administrator');

-- Modul zakázky
DROP POLICY IF EXISTS "Admin a vedoucí čtou zakázky" ON job_orders;
CREATE POLICY "Admin čte zakázky"
  ON job_orders FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou dokumenty zakázek" ON job_order_documents;
CREATE POLICY "Admin čte dokumenty zakázek"
  ON job_order_documents FOR SELECT
  USING (get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Admin a vedoucí čtou fotky zakázek" ON job_order_photos;
CREATE POLICY "Admin čte fotky zakázek"
  ON job_order_photos FOR SELECT
  USING (get_user_role() = 'administrator');

-- Modul náklady
DROP POLICY IF EXISTS "Admin čte náklady" ON job_costs;
-- policy may already be admin only

-- Modul fotodokumentace
DROP POLICY IF EXISTS "ERP uživatelé čtou fotodokumentaci" ON gps_photos;
DROP POLICY IF EXISTS "ERP uživatelé vytváří fotodokumentaci" ON gps_photos;
DROP POLICY IF EXISTS "ERP uživatelé upravují fotodokumentaci" ON gps_photos;
DROP POLICY IF EXISTS "Admin maže fotodokumentaci" ON gps_photos;
DROP POLICY IF EXISTS "Admin a vedoucí čtou fotky" ON gps_photos;
DROP POLICY IF EXISTS "Admin a vedoucí vkládají fotky" ON gps_photos;
DROP POLICY IF EXISTS "Admin a vedoucí upravují fotky" ON gps_photos;
DROP POLICY IF EXISTS "ERP uživatelé čtou historii fotek" ON gps_photo_history;
DROP POLICY IF EXISTS "ERP uživatelé zapisují historii fotek" ON gps_photo_history;
DROP POLICY IF EXISTS "Admin a vedoucí čtou historii fotek" ON gps_photo_history;
DROP POLICY IF EXISTS "Admin a vedoucí zapisují historii fotek" ON gps_photo_history;

CREATE POLICY "Admin čte fotky"
  ON gps_photos FOR SELECT
  USING (get_user_role() = 'administrator');
CREATE POLICY "Admin vkládá fotky"
  ON gps_photos FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');
CREATE POLICY "Admin upravuje fotky"
  ON gps_photos FOR UPDATE
  USING (get_user_role() = 'administrator');
CREATE POLICY "Admin maže fotky"
  ON gps_photos FOR DELETE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin čte historii fotek"
  ON gps_photo_history FOR SELECT
  USING (get_user_role() = 'administrator');
CREATE POLICY "Admin zapisuje historii fotek"
  ON gps_photo_history FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

-- Stavební deník
DROP POLICY IF EXISTS "ERP uživatelé čtou stavební deník" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin vytváří zápisy deníku" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin upravuje zápisy deníku" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin maže zápisy deníku" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin a vedoucí čtou deník" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin a vedoucí vkládají deník" ON construction_diary_entries;
DROP POLICY IF EXISTS "Admin a vedoucí upravují deník" ON construction_diary_entries;

CREATE POLICY "Admin čte deník"
  ON construction_diary_entries FOR SELECT
  USING (get_user_role() = 'administrator');
CREATE POLICY "Admin vkládá deník"
  ON construction_diary_entries FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');
CREATE POLICY "Admin upravuje deník"
  ON construction_diary_entries FOR UPDATE
  USING (get_user_role() = 'administrator');
CREATE POLICY "Admin maže deník"
  ON construction_diary_entries FOR DELETE
  USING (get_user_role() = 'administrator');

-- Přípojky
DROP POLICY IF EXISTS "Admin a vedoucí čtou přípojky" ON utility_connections;
CREATE POLICY "Admin čte přípojky"
  ON utility_connections FOR SELECT
  USING (get_user_role() = 'administrator');

-- Nastavení – pouze admin (kromě vlastního app_settings profilu)
DROP POLICY IF EXISTS "Přihlášení vidí nastavení aplikace" ON app_settings;
CREATE POLICY "Admin a vlastník vidí nastavení aplikace"
  ON app_settings FOR SELECT
  USING (user_id = auth.uid() OR get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Přihlášení upravují své nastavení" ON app_settings;
CREATE POLICY "Admin a vlastník upravují nastavení aplikace"
  ON app_settings FOR UPDATE
  USING (user_id = auth.uid() OR get_user_role() = 'administrator');

DROP POLICY IF EXISTS "Přihlášení vidí nastavení společnosti" ON company_settings;
CREATE POLICY "Admin vidí nastavení společnosti"
  ON company_settings FOR SELECT
  USING (get_user_role() = 'administrator');

-- Portálové RPC – striktní validace tokenu
CREATE OR REPLACE FUNCTION portal_get_worker(p_token UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  "position" TEXT,
  status worker_status,
  employment_type employment_type,
  assigned_order TEXT,
  assigned_order_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.id,
    w.first_name,
    w.last_name,
    w."position",
    w.status,
    w.employment_type,
    COALESCE(jo.name, w.assigned_order, ''),
    w.assigned_order_id
  FROM workers w
  LEFT JOIN job_orders jo ON jo.id = w.assigned_order_id
  WHERE w.id = resolve_portal_worker_id(p_token);
$$;

CREATE OR REPLACE FUNCTION portal_get_reports(p_token UUID)
RETURNS SETOF worker_reports
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM worker_reports r
  WHERE r.worker_id = resolve_portal_worker_id(p_token)
  ORDER BY r.report_date DESC;
$$;

CREATE OR REPLACE FUNCTION portal_get_earnings_summary(p_token UUID)
RETURNS TABLE (
  today_earnings NUMERIC,
  month_earnings NUMERIC,
  month_hours NUMERIC,
  month_meters NUMERIC,
  month_orders INTEGER,
  month_advances NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id UUID := resolve_portal_worker_id(p_token);
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(earnings) FROM worker_daily_forms WHERE worker_id = v_worker_id AND form_date = CURRENT_DATE AND status IN ('odeslany', 'schvaleny')), 0),
    COALESCE((SELECT SUM(earnings) FROM worker_reports WHERE worker_id = v_worker_id AND report_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(hours) FROM worker_attendance_records WHERE worker_id = v_worker_id AND attendance_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(meters) FROM worker_statistics WHERE worker_id = v_worker_id AND stat_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(orders_count)::INTEGER FROM worker_statistics WHERE worker_id = v_worker_id AND stat_date >= date_trunc('month', CURRENT_DATE)::date), 0),
    COALESCE((SELECT SUM(advances) FROM worker_statistics WHERE worker_id = v_worker_id AND stat_date >= date_trunc('month', CURRENT_DATE)::date), 0);
END;
$$;


-- =============================================================================
-- MIGRATION: 019_module12_paragony.sql
-- =============================================================================

-- Modul 12 – Paragony (účtenky pro účetnictví)
-- Spusťte po 018_erp_security_lockdown.sql

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_date DATE NOT NULL,
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  expense_name TEXT NOT NULL,
  amount NUMERIC(12, 2) CHECK (amount IS NULL OR amount >= 0),
  supplier TEXT,
  note TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  captured_date DATE NOT NULL,
  captured_time TIME NOT NULL,
  gps_lat NUMERIC(10, 7),
  gps_lng NUMERIC(10, 7),
  gps_accuracy NUMERIC(10, 2),
  address_full TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipts_date ON receipts(receipt_date DESC);
CREATE INDEX idx_receipts_order ON receipts(order_id);
CREATE INDEX idx_receipts_order_date ON receipts(order_id, receipt_date);

CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte paragony"
  ON receipts FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin vkládá paragony"
  ON receipts FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje paragony"
  ON receipts FOR UPDATE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin maže paragony"
  ON receipts FOR DELETE
  USING (get_user_role() = 'administrator');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('receipt-photos', 'receipt-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin nahrává fotografie paragonů"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipt-photos');

CREATE POLICY "Admin čte fotografie paragonů"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipt-photos');

CREATE POLICY "Veřejné čtení fotografií paragonů"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'receipt-photos');

CREATE POLICY "Admin maže fotografie paragonů"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipt-photos');

-- Registrace modulu 12 – Paragony
INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES ('paragony', 'Paragony', '/paragony', 'Receipt', 8, true, '1.0.0')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  is_implemented = true,
  module_version = EXCLUDED.module_version;

-- E-mail účetní pro odeslání paragonů (volitelné nastavení společnosti)
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS accountant_email TEXT NOT NULL DEFAULT '';


-- =============================================================================
-- MIGRATION: 020_portal_grants_attendance.sql
-- =============================================================================

-- Oprava chybějících GRANT po změně signatury portal_save_form v migraci 010
GRANT EXECUTE ON FUNCTION portal_save_form(
  UUID, UUID, DATE, UUID, TIME, TIME, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB
) TO anon, authenticated;

-- Sčítání hodin docházky při více odeslaných formulářích za jeden den
CREATE OR REPLACE FUNCTION submit_worker_daily_form(p_form_id UUID)
RETURNS VOID AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_earnings NUMERIC;
  v_activity TEXT;
  v_meters NUMERIC;
  v_pieces NUMERIC;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id FOR UPDATE;

  IF v_form.status NOT IN ('koncept', 'k_oprave') THEN
    RAISE EXCEPTION 'Formulář nelze odeslat v aktuálním stavu';
  END IF;

  IF v_form.signature_data IS NULL OR v_form.signature_data = '' THEN
    RAISE EXCEPTION 'Formulář vyžaduje podpis zaměstnance';
  END IF;

  IF v_form.order_id IS NULL THEN
    RAISE EXCEPTION 'Formulář vyžaduje aktivní zakázku';
  END IF;

  v_earnings := calculate_form_earnings(p_form_id);
  v_activity := derive_form_activity(v_form.work_type, v_form.work_description, p_form_id);

  SELECT t.total_meters, t.total_pieces INTO v_meters, v_pieces
  FROM derive_form_totals(p_form_id) t;

  UPDATE worker_daily_forms SET
    earnings = v_earnings,
    activity = v_activity,
    meters = v_meters,
    pieces = v_pieces,
    status = 'odeslany',
    submitted_at = now()
  WHERE id = p_form_id;

  IF EXISTS (SELECT 1 FROM worker_reports WHERE form_id = p_form_id) THEN
    UPDATE worker_reports SET
      report_date = v_form.form_date,
      order_id = v_form.order_id,
      order_name = v_form.order_name,
      activity = v_activity,
      hours = v_form.hours,
      meters = v_meters,
      pieces = v_pieces,
      earnings = v_earnings,
      material = COALESCE(v_form.material, ''),
      advance = COALESCE(v_form.advance, 0),
      note = v_form.note,
      status = 'cekajici'
    WHERE form_id = p_form_id;
  ELSE
    INSERT INTO worker_reports (
      worker_id, form_id, report_date, order_id, order_name, activity,
      hours, meters, pieces, earnings, material, advance, note, status
    )
    VALUES (
      v_form.worker_id, p_form_id, v_form.form_date, v_form.order_id, v_form.order_name, v_activity,
      v_form.hours, v_meters, v_pieces, v_earnings,
      COALESCE(v_form.material, ''), COALESCE(v_form.advance, 0), v_form.note, 'cekajici'
    );
  END IF;

  INSERT INTO worker_attendance_records (
    worker_id, form_id, attendance_date, order_id, order_name, hours, work_start, work_end, break_minutes
  )
  VALUES (
    v_form.worker_id, p_form_id, v_form.form_date, v_form.order_id, v_form.order_name, v_form.hours,
    v_form.work_start, v_form.work_end, COALESCE(v_form.break_minutes, 0)
  )
  ON CONFLICT (worker_id, attendance_date)
  DO UPDATE SET
    hours = worker_attendance_records.hours + EXCLUDED.hours,
    form_id = EXCLUDED.form_id,
    order_id = COALESCE(EXCLUDED.order_id, worker_attendance_records.order_id),
    order_name = COALESCE(NULLIF(EXCLUDED.order_name, ''), worker_attendance_records.order_name),
    work_start = COALESCE(EXCLUDED.work_start, worker_attendance_records.work_start),
    work_end = COALESCE(EXCLUDED.work_end, worker_attendance_records.work_end),
    break_minutes = worker_attendance_records.break_minutes + EXCLUDED.break_minutes;

  INSERT INTO worker_statistics (worker_id, stat_date, earnings, hours, meters, orders_count, advances)
  VALUES (v_form.worker_id, v_form.form_date, v_earnings, v_form.hours, v_meters, 1, v_form.advance)
  ON CONFLICT (worker_id, stat_date)
  DO UPDATE SET
    earnings = worker_statistics.earnings + EXCLUDED.earnings,
    hours = worker_statistics.hours + EXCLUDED.hours,
    meters = worker_statistics.meters + EXCLUDED.meters,
    orders_count = worker_statistics.orders_count + 1,
    advances = worker_statistics.advances + EXCLUDED.advances;

  INSERT INTO worker_history (worker_id, action, details)
  VALUES (v_form.worker_id, 'Denní výkaz vytvořen', jsonb_build_object(
    'form_id', p_form_id,
    'order_id', v_form.order_id,
    'order_name', v_form.order_name,
    'form_date', v_form.form_date,
    'earnings', v_earnings,
    'advance', v_form.advance,
    'hours', v_form.hours
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- MIGRATION: 021_workers_admin_write_rls.sql
-- =============================================================================

-- Explicitní RLS pro správu zaměstnanců administrátorem (konzistentní s migrací 018)

DROP POLICY IF EXISTS "Admin spravuje zaměstnance" ON workers;

CREATE POLICY "Admin vytváří zaměstnance"
  ON workers FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje zaměstnance"
  ON workers FOR UPDATE
  USING (get_user_role() = 'administrator')
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin maže zaměstnance"
  ON workers FOR DELETE
  USING (get_user_role() = 'administrator');

-- Historie zaměstnance – admin může zapisovat (archivace, obnova stavu)
DROP POLICY IF EXISTS "Admin zapisuje historii" ON worker_history;
CREATE POLICY "Admin zapisuje historii"
  ON worker_history FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');


-- =============================================================================
-- MIGRATION: 022_module_profit_overview.sql
-- =============================================================================

-- Modul – Přehled hospodaření a zisku
-- Spusťte po 021_workers_admin_write_rls.sql

CREATE TYPE job_cost_category AS ENUM (
  'material',
  'naradi',
  'pujcovna',
  'ubytovani',
  'phm',
  'jizdenky',
  'ostatni'
);

ALTER TABLE job_costs
  ADD COLUMN IF NOT EXISTS category job_cost_category NOT NULL DEFAULT 'ostatni';

CREATE INDEX IF NOT EXISTS idx_job_costs_category ON job_costs(category);

CREATE TABLE IF NOT EXISTS job_order_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  invoice_number TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_order_invoices_order ON job_order_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_job_order_invoices_date ON job_order_invoices(invoice_date);

ALTER TABLE job_order_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte fakturaci zakázek"
  ON job_order_invoices FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin spravuje fakturaci zakázek"
  ON job_order_invoices FOR ALL
  USING (get_user_role() = 'administrator');

CREATE OR REPLACE FUNCTION get_profit_overview(
  p_order_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  order_name TEXT,
  period_from DATE,
  period_to DATE,
  invoiced_amount NUMERIC,
  labor_costs NUMERIC,
  employee_advances NUMERIC,
  material_costs NUMERIC,
  tools_costs NUMERIC,
  rental_costs NUMERIC,
  accommodation_costs NUMERIC,
  fuel_costs NUMERIC,
  tickets_costs NUMERIC,
  other_costs NUMERIC,
  total_costs NUMERIC,
  net_profit NUMERIC,
  profit_margin NUMERIC
) AS $$
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  RETURN QUERY
  WITH orders_scope AS (
    SELECT jo.id, jo.name, jo.start_date, jo.end_date
    FROM job_orders jo
    WHERE p_order_id IS NULL OR jo.id = p_order_id
  ),
  periods AS (
    SELECT
      o.id,
      o.name,
      COALESCE(p_date_from, o.start_date) AS period_from,
      COALESCE(p_date_to, LEAST(o.end_date, CURRENT_DATE)) AS period_to
    FROM orders_scope o
  ),
  aggregated AS (
    SELECT
      p.id,
      p.name,
      p.period_from,
      p.period_to,
      COALESCE((
        SELECT SUM(joi.amount)
        FROM job_order_invoices joi
        WHERE joi.order_id = p.id
          AND joi.invoice_date BETWEEN p.period_from AND p.period_to
      ), 0) AS invoiced_amount,
      COALESCE((
        SELECT SUM(r.earnings)
        FROM worker_reports r
        WHERE r.order_id = p.id
          AND r.status = 'schvaleny'
          AND r.report_date BETWEEN p.period_from AND p.period_to
      ), 0) AS labor_costs,
      COALESCE((
        SELECT SUM(r.advance)
        FROM worker_reports r
        WHERE r.order_id = p.id
          AND r.status = 'schvaleny'
          AND r.report_date BETWEEN p.period_from AND p.period_to
      ), 0) AS employee_advances,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'material'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS material_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'naradi'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS tools_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'pujcovna'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS rental_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'ubytovani'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS accommodation_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'phm'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS fuel_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'jizdenky'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) AS tickets_costs,
      COALESCE((
        SELECT SUM(c.price)
        FROM job_costs c
        WHERE c.order_id = p.id
          AND c.category = 'ostatni'
          AND c.cost_date BETWEEN p.period_from AND p.period_to
      ), 0) + COALESCE((
        SELECT SUM(rec.amount)
        FROM receipts rec
        WHERE rec.order_id = p.id
          AND rec.receipt_date BETWEEN p.period_from AND p.period_to
          AND rec.amount IS NOT NULL
      ), 0) AS other_costs
    FROM periods p
  )
  SELECT
    a.id AS order_id,
    a.name AS order_name,
    a.period_from,
    a.period_to,
    a.invoiced_amount,
    a.labor_costs,
    a.employee_advances,
    a.material_costs,
    a.tools_costs,
    a.rental_costs,
    a.accommodation_costs,
    a.fuel_costs,
    a.tickets_costs,
    a.other_costs,
    (
      a.labor_costs + a.employee_advances + a.material_costs + a.tools_costs +
      a.rental_costs + a.accommodation_costs + a.fuel_costs + a.tickets_costs + a.other_costs
    ) AS total_costs,
    a.invoiced_amount - (
      a.labor_costs + a.employee_advances + a.material_costs + a.tools_costs +
      a.rental_costs + a.accommodation_costs + a.fuel_costs + a.tickets_costs + a.other_costs
    ) AS net_profit,
    CASE
      WHEN a.invoiced_amount > 0 THEN ROUND(
        (
          (a.invoiced_amount - (
            a.labor_costs + a.employee_advances + a.material_costs + a.tools_costs +
            a.rental_costs + a.accommodation_costs + a.fuel_costs + a.tickets_costs + a.other_costs
          )) / a.invoiced_amount
        ) * 100,
        2
      )
      ELSE NULL
    END AS profit_margin
  FROM aggregated a
  ORDER BY a.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_profit_overview(UUID, DATE, DATE) TO authenticated;

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id = 'denni-formulare';

UPDATE erp_modules
SET
  is_implemented = true,
  module_version = '1.0.0',
  label = 'Přehled hospodaření a zisku'
WHERE id = 'statistiky';


-- =============================================================================
-- MIGRATION: 023_grants_new_tables.sql
-- =============================================================================

-- Oprávnění pro nové tabulky z migrace 022
GRANT SELECT, INSERT, UPDATE, DELETE ON job_order_invoices TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;


-- =============================================================================
-- MIGRATION: 024_company_logos_storage.sql
-- =============================================================================

-- Centrální logo společnosti (bucket company-logos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('company-logos', 'company-logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "Authenticated upload company logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY IF NOT EXISTS "Public read company logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-logos');

CREATE POLICY IF NOT EXISTS "Authenticated update company logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos');

CREATE POLICY IF NOT EXISTS "Authenticated delete company logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos');

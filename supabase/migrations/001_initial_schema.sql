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

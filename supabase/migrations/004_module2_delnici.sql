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

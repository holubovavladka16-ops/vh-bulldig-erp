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

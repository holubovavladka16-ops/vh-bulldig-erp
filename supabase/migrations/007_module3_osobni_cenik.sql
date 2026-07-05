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

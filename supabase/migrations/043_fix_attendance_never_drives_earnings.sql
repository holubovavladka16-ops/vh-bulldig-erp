-- OPRAVA VÝPOČTU VÝDĚLKU: docházka (OD–DO) nesmí nikdy automaticky násobit hodinovou sazbou.
--
-- Kontext: `calculate_form_earnings` (migrace 007) odjakživa obsahovala větev, která pro
-- work_type IN ('hodinova', 'kombinovana') automaticky přičetla `worker_daily_forms.hours`
-- (odvozeno výhradně z docházkových časů OD–DO přes calc_work_hours) × cena položky ceníku
-- nazvané přesně "Hodinová sazba". Tato hodnota `hours` je tatáž, která se ukládá do
-- worker_attendance_records/worker_statistics pro účely evidence docházky.
--
-- Výsledek: pokud měl pracovník ve svém osobním ceníku aktivní položku "Hodinová sazba", jeho
-- docházkové hodiny OD–DO se AUTOMATICKY vynásobily touto sazbou a přičetly k výdělku – bez ohledu
-- na to, kolik hodin/výkonů bylo skutečně zapsáno ve Výkazu práce. Přesně to, co nesmí nastat.
--
-- Oprava: výdělek se nyní počítá VÝHRADNĚ součtem položek z `worker_form_task_items` (Výkaz práce),
-- bez výjimky a bez ohledu na work_type. Sloupec `hours` na `worker_daily_forms` (a navazující
-- worker_attendance_records/worker_statistics) zůstává beze změny – nadále čistě eviduje docházku
-- (OD–DO), ale už nijak neovlivňuje výdělek. Položka "Hodinová sazba" přestává být speciální výjimkou
-- a chová se jako každá jiná položka ceníku: pokud ji admin/pracovník explicitně zapíše do Výkazu
-- práce s konkrétním množstvím (např. 4 hodiny), počítá se přesně jako "4 × cena" – stejně jako
-- "Pomocné práce" nebo jakákoli jiná položka.

-- 0) KRITICKÁ CHYBA NAVÍC NALEZENA při přípravě této migrace: calculate_task_line_earnings (beze
--    změny od migrace 007) vůbec neuměla typ jednotky "hodina" – v CASE výrazu chyběla větev
--    WHEN 'hodina', takže spadala do ELSE → 0. Bez této opravy by "Hodinová práce" zapsaná jako
--    výkon vycházela v databázi vždy na 0 Kč, i když frontendový živý náhled počítal správně.
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
    WHEN 'hodina' THEN RETURN COALESCE(p_quantity, 0) * p_price;
    WHEN 'pausal' THEN
      RETURN CASE WHEN COALESCE(p_quantity, 0) > 0 THEN p_price * p_quantity ELSE 0 END;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1) Výdělek = vždy jen součet položek Výkazu práce, bez automatického násobení docházkových hodin.
CREATE OR REPLACE FUNCTION calculate_form_earnings(p_form_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_form worker_daily_forms%ROWTYPE;
  v_task_sum NUMERIC := 0;
BEGIN
  SELECT * INTO v_form FROM worker_daily_forms WHERE id = p_form_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(line_earnings), 0) INTO v_task_sum
  FROM worker_form_task_items WHERE form_id = p_form_id;

  RETURN v_task_sum;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2) "Hodinová sazba" už není vyloučena z ukládání jako běžná položka Výkazu práce – pokud ji
--    admin/pracovník explicitně zapíše s množstvím, uloží se a započítá jako kterákoli jiná položka.
--    (Jinak beze změny oproti původní verzi z migrace 007 – jen odstraněn řádek "AND name <> ...".)
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

-- 3) admin_upsert_attendance: přestat odvádět explicitní položku "Hodinová sazba" pryč z Výkazu
--    práce do proměnné v_hours, a přestat přepisovat v_hours docházkovými hodinami pro účely
--    výdělku. `hours` sloupec zůstává vždy = docházkové hodiny OD–DO (evidence), zcela odděleně
--    od toho, co se uloží jako položky Výkazu práce (a tedy od výdělku).
DROP FUNCTION IF EXISTS admin_upsert_attendance(UUID, DATE, UUID, NUMERIC, TEXT, JSONB, TIME, TIME, INTEGER, UUID, UUID, attendance_status);

CREATE OR REPLACE FUNCTION admin_upsert_attendance(
  p_worker_id UUID,
  p_attendance_date DATE,
  p_order_id UUID,
  p_advance NUMERIC,
  p_note TEXT,
  p_task_items JSONB,
  p_work_start TIME DEFAULT NULL,
  p_work_end TIME DEFAULT NULL,
  p_break_minutes INTEGER DEFAULT 0,
  p_id UUID DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL,
  p_status attendance_status DEFAULT 'pritomen'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_name TEXT;
  v_form_id UUID;
  v_hours NUMERIC(8, 2) := 0;
  v_item JSONB;
  v_has_tasks BOOLEAN := false;
  v_work_type work_type;
  v_earnings NUMERIC;
  v_attendance_id UUID;
  v_existing_form_id UUID;
  v_filtered_items JSONB := '[]'::jsonb;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění pro správu docházky';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Vyberte zakázku';
  END IF;

  SELECT name INTO v_order_name FROM job_orders WHERE id = p_order_id;
  IF v_order_name IS NULL THEN
    RAISE EXCEPTION 'Zakázka neexistuje';
  END IF;

  -- Docházkové hodiny (OD–DO) – čistě evidenční, nikdy nevstupují do výdělku.
  v_hours := COALESCE(calc_work_hours(p_work_start, p_work_end, COALESCE(p_break_minutes, 0)), 0);

  -- Všechny položky Výkazu práce (včetně případné "Hodinová sazba") se ukládají jako běžné
  -- položky s vlastním množstvím – žádná se speciálně neodvádí pryč do docházkových hodin.
  IF p_task_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_task_items)
    LOOP
      IF COALESCE((v_item->>'quantity')::NUMERIC, 0) > 0 THEN
        v_has_tasks := true;
        v_filtered_items := v_filtered_items || jsonb_build_array(v_item);
      END IF;
    END LOOP;
  END IF;

  v_work_type := CASE
    WHEN v_hours > 0 AND v_has_tasks THEN 'kombinovana'::work_type
    WHEN v_has_tasks THEN 'ukolova'::work_type
    WHEN v_hours > 0 THEN 'hodinova'::work_type
    ELSE 'ukolova'::work_type
  END;

  IF p_id IS NOT NULL THEN
    SELECT form_id INTO v_existing_form_id FROM worker_attendance_records WHERE id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Záznam docházky neexistuje';
    END IF;
  END IF;

  IF v_existing_form_id IS NOT NULL THEN
    v_form_id := v_existing_form_id;

    UPDATE worker_daily_forms SET
      form_date = p_attendance_date,
      order_id = p_order_id,
      order_name = v_order_name,
      work_type = v_work_type,
      work_start = p_work_start,
      work_end = p_work_end,
      break_minutes = COALESCE(p_break_minutes, 0),
      hours = v_hours,
      advance = COALESCE(p_advance, 0),
      note = COALESCE(p_note, '')
    WHERE id = v_form_id;
  ELSE
    INSERT INTO worker_daily_forms (
      worker_id, form_date, order_id, order_name, activity, work_type, work_description,
      work_start, work_end, break_minutes, hours, advance, note, status, signature_data
    )
    VALUES (
      p_worker_id, p_attendance_date, p_order_id, v_order_name, '', v_work_type, 'Ruční zápis docházky',
      p_work_start, p_work_end, COALESCE(p_break_minutes, 0), v_hours, COALESCE(p_advance, 0),
      COALESCE(p_note, ''), 'odeslany', 'admin-manual'
    )
    RETURNING id INTO v_form_id;
  END IF;

  -- Vždy ulož přesně to, co bylo zapsáno do Výkazu práce (prázdné pole = žádné položky, v pořádku).
  PERFORM save_form_task_items(v_form_id, p_worker_id, v_filtered_items);

  UPDATE worker_daily_forms SET status = 'odeslany'
  WHERE id = v_form_id AND status NOT IN ('schvaleny');

  PERFORM sync_form_downstream(v_form_id);

  IF p_status IS DISTINCT FROM 'pritomen' THEN
    UPDATE worker_attendance_records
    SET attendance_status = p_status
    WHERE worker_id = p_worker_id AND attendance_date = p_attendance_date;
  END IF;

  SELECT earnings INTO v_earnings FROM worker_daily_forms WHERE id = v_form_id;

  IF p_id IS NOT NULL THEN
    v_attendance_id := p_id;
  ELSE
    SELECT id INTO v_attendance_id
    FROM worker_attendance_records
    WHERE worker_id = p_worker_id AND attendance_date = p_attendance_date;
  END IF;

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (
    p_worker_id,
    CASE WHEN v_existing_form_id IS NULL THEN 'Docházka vytvořena' ELSE 'Docházka upravena' END,
    jsonb_build_object(
      'attendance_id', v_attendance_id,
      'form_id', v_form_id,
      'attendance_date', p_attendance_date,
      'attendance_status', p_status,
      'advance', COALESCE(p_advance, 0),
      'attendance_hours', v_hours,
      'earnings', v_earnings,
      'order_id', p_order_id,
      'source', 'manual'
    ),
    p_performed_by
  );

  RETURN v_attendance_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_attendance(
  UUID, DATE, UUID, NUMERIC, TEXT, JSONB, TIME, TIME, INTEGER, UUID, UUID, attendance_status
) TO authenticated;

-- 4) admin_save_form: dřív při work_type = 'hodinova' MAZALA veškeré položky Výkazu práce (větev
--    ELSE DELETE FROM worker_form_task_items). Po opravě výdělku výše by to znamenalo, že
--    formulář označený jako "hodinová" práce by měl VŽDY nulový výdělek, i kdyby položky byly
--    zapsané. Ukládej položky vždy, bez ohledu na zvolený work_type.
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

  PERFORM save_form_task_items(p_form_id, v_worker_id, p_task_items);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION admin_save_form(
  UUID, DATE, UUID, work_type, TEXT, TIME, TIME, INTEGER, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB
) TO authenticated;

-- 5) Sjednocení názvu: nově se položka jmenuje "Hodinová práce" (konzistentní s tím, co se
--    nabízí novým pracovníkům). Jde čistě o přejmenování popisku existujících položek ceníku –
--    žádná data se neztrácí, historické výkony zůstávají propojené přes price_item_id.
UPDATE worker_price_items SET name = 'Hodinová práce' WHERE name = 'Hodinová sazba';

NOTIFY pgrst, 'reload schema';

-- Umožnit smazání docházky vytvořené správcem (signature_data = 'admin-manual').
-- Portálové formuláře zůstávají chráněné.

CREATE OR REPLACE FUNCTION admin_delete_attendance(
  p_id UUID,
  p_performed_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record worker_attendance_records%ROWTYPE;
  v_form_sig TEXT;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění pro správu docházky';
  END IF;

  SELECT * INTO v_record FROM worker_attendance_records WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Záznam docházky neexistuje';
  END IF;

  IF v_record.form_id IS NOT NULL THEN
    SELECT signature_data INTO v_form_sig
    FROM worker_daily_forms
    WHERE id = v_record.form_id;

    IF v_form_sig IS DISTINCT FROM 'admin-manual' THEN
      RAISE EXCEPTION 'Záznam z formuláře zaměstnance nelze smazat zde. Upravte nebo smažte formulář.';
    END IF;

    DELETE FROM worker_reports WHERE form_id = v_record.form_id;
    DELETE FROM worker_daily_forms WHERE id = v_record.form_id;
  ELSE
    DELETE FROM worker_reports
    WHERE worker_id = v_record.worker_id
      AND report_date = v_record.attendance_date
      AND form_id IS NULL;
  END IF;

  DELETE FROM worker_attendance_records WHERE id = p_id;

  INSERT INTO worker_history (worker_id, action, details, performed_by)
  VALUES (
    v_record.worker_id,
    'Docházka smazána',
    jsonb_build_object(
      'attendance_id', p_id,
      'attendance_date', v_record.attendance_date,
      'source', CASE WHEN v_form_sig = 'admin-manual' THEN 'admin-manual' ELSE 'manual' END
    ),
    p_performed_by
  );
END;
$$;

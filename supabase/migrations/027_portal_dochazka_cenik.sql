-- Portál: docházka včetně stavu a poznámky

DROP FUNCTION IF EXISTS portal_get_attendance(UUID);

CREATE OR REPLACE FUNCTION portal_get_attendance(p_token UUID)
RETURNS TABLE (
  id UUID,
  attendance_date DATE,
  order_id UUID,
  order_name TEXT,
  work_start TIME,
  work_end TIME,
  break_minutes INTEGER,
  hours NUMERIC,
  attendance_status attendance_status,
  note TEXT
) AS $$
  SELECT
    a.id,
    a.attendance_date,
    a.order_id,
    COALESCE(NULLIF(a.order_name, ''), f.order_name, ''),
    a.work_start,
    a.work_end,
    a.break_minutes,
    a.hours,
    a.attendance_status,
    a.note
  FROM worker_attendance_records a
  JOIN workers w ON w.id = a.worker_id
  LEFT JOIN worker_daily_forms f ON f.id = a.form_id
  WHERE w.portal_token = p_token AND w.status = 'aktivni'
  ORDER BY a.attendance_date DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION portal_get_attendance(UUID) TO anon, authenticated;

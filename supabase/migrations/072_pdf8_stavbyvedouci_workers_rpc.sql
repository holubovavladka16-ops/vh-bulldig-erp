-- PDF 8 Fáze 1h – RPC pro pracovníky na přidělené zakázce (Stavbyvedoucí)

CREATE OR REPLACE FUNCTION list_workers_for_assigned_order(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT
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
    trim(w.last_name || ' ' || w.first_name) AS full_name
  FROM workers w
  WHERE w.status = 'aktivni'
    AND w.assigned_order_id = p_order_id
    AND (
      has_full_project_access()
      OR (is_stavbyvedouci() AND is_assigned_to_project(p_order_id))
    )
  ORDER BY w.last_name, w.first_name;
$$;

GRANT EXECUTE ON FUNCTION list_workers_for_assigned_order(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

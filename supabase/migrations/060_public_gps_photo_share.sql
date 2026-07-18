-- Veřejné read-only sdílení konkrétní GPS fotografie (bez ERP přihlášení).
-- Přístup pouze přes znalost UUID fotografie – vrací omezená metadata, žádné citlivé údaje zaměstnance.

CREATE OR REPLACE FUNCTION get_public_gps_photo(p_photo_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT json_build_object(
    'id', p.id,
    'file_path', p.file_path,
    'file_name', p.file_name,
    'captured_date', p.captured_date,
    'captured_time', p.captured_time,
    'gps_lat', p.gps_lat,
    'gps_lng', p.gps_lng,
    'gps_accuracy', p.gps_accuracy,
    'address_full', p.address_full,
    'street', p.street,
    'city', p.city,
    'postal_code', p.postal_code,
    'country', p.country,
    'note', p.note,
    'order_name', jo.name
  )
  FROM gps_photos p
  LEFT JOIN job_orders jo ON jo.id = p.order_id
  WHERE p.id = p_photo_id;
$$;

GRANT EXECUTE ON FUNCTION get_public_gps_photo(UUID) TO anon, authenticated;

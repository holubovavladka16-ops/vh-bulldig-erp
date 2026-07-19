-- Veřejný přístup ke sdílené galerii fotografií (token URL)

CREATE OR REPLACE FUNCTION get_public_photo_gallery(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gallery gps_photo_public_galleries%ROWTYPE;
  v_photos JSON;
  v_order_name TEXT;
BEGIN
  SELECT * INTO v_gallery
  FROM gps_photo_public_galleries
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_gallery.expires_at IS NOT NULL AND v_gallery.expires_at < now() THEN
    RETURN NULL;
  END IF;

  SELECT name INTO v_order_name FROM job_orders WHERE id = v_gallery.order_id;

  SELECT COALESCE(json_agg(row_to_json(p) ORDER BY p.captured_at DESC), '[]'::json)
  INTO v_photos
  FROM (
    SELECT
      gp.id,
      gp.file_path,
      gp.file_name,
      gp.thumbnail_path,
      gp.captured_date,
      gp.captured_time,
      gp.captured_at,
      CASE WHEN v_gallery.show_address THEN gp.address_full ELSE NULL END AS address_full,
      CASE WHEN v_gallery.show_gps THEN gp.gps_lat ELSE NULL END AS gps_lat,
      CASE WHEN v_gallery.show_gps THEN gp.gps_lng ELSE NULL END AS gps_lng,
      gp.note,
      gp.photo_type
    FROM gps_photos gp
    WHERE gp.id = ANY(v_gallery.photo_ids)
      AND gp.deleted_at IS NULL
  ) p;

  RETURN json_build_object(
    'order_name', v_order_name,
    'allow_download', v_gallery.allow_download,
    'show_address', v_gallery.show_address,
    'show_gps', v_gallery.show_gps,
    'photos', v_photos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_photo_gallery(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

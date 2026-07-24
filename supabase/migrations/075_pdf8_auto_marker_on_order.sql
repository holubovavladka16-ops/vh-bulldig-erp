-- PDF 8 – automatické vytvoření špendlíku při vytvoření/úpravě zakázky (DB fallback)
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_sync_project_map_marker_on_order_update ON job_orders;
--   DROP TRIGGER IF EXISTS trg_ensure_project_map_marker_on_order_insert ON job_orders;
--   DROP FUNCTION IF EXISTS sync_project_map_marker_on_order_update();
--   DROP FUNCTION IF EXISTS ensure_project_map_marker_on_order_insert();

CREATE OR REPLACE FUNCTION ensure_project_map_marker_on_order_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_approximate BOOLEAN;
BEGIN
  v_is_approximate :=
    NEW.gps_lat IS NULL
    OR NEW.gps_lng IS NULL
    OR NEW.gps_accuracy IS NULL
    OR NEW.gps_accuracy > 15;

  INSERT INTO project_map_markers (
    project_id,
    gps_lat,
    gps_lng,
    gps_accuracy,
    is_approximate,
    marker_color,
    color_source,
    color_label
  )
  VALUES (
    NEW.id,
    NEW.gps_lat,
    NEW.gps_lng,
    NEW.gps_accuracy,
    v_is_approximate,
    'red',
    'auto',
    'Chybí stavební deník'
  )
  ON CONFLICT (project_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_project_map_marker_on_order_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_approximate BOOLEAN;
BEGIN
  IF NEW.gps_lat IS NOT DISTINCT FROM OLD.gps_lat
     AND NEW.gps_lng IS NOT DISTINCT FROM OLD.gps_lng
     AND NEW.gps_accuracy IS NOT DISTINCT FROM OLD.gps_accuracy THEN
    RETURN NEW;
  END IF;

  v_is_approximate :=
    NEW.gps_lat IS NULL
    OR NEW.gps_lng IS NULL
    OR NEW.gps_accuracy IS NULL
    OR NEW.gps_accuracy > 15;

  UPDATE project_map_markers
  SET
    gps_lat = NEW.gps_lat,
    gps_lng = NEW.gps_lng,
    gps_accuracy = NEW.gps_accuracy,
    is_approximate = v_is_approximate,
    updated_at = now()
  WHERE project_id = NEW.id
    AND (
      gps_lat IS NULL
      OR gps_lng IS NULL
      OR gps_lat IS DISTINCT FROM NEW.gps_lat
      OR gps_lng IS DISTINCT FROM NEW.gps_lng
    );

  IF NOT FOUND THEN
    INSERT INTO project_map_markers (
      project_id,
      gps_lat,
      gps_lng,
      gps_accuracy,
      is_approximate,
      marker_color,
      color_source,
      color_label
    )
    VALUES (
      NEW.id,
      NEW.gps_lat,
      NEW.gps_lng,
      NEW.gps_accuracy,
      v_is_approximate,
      'red',
      'auto',
      'Chybí stavební deník'
    )
    ON CONFLICT (project_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_project_map_marker_on_order_insert ON job_orders;
CREATE TRIGGER trg_ensure_project_map_marker_on_order_insert
  AFTER INSERT ON job_orders
  FOR EACH ROW
  EXECUTE FUNCTION ensure_project_map_marker_on_order_insert();

DROP TRIGGER IF EXISTS trg_sync_project_map_marker_on_order_update ON job_orders;
CREATE TRIGGER trg_sync_project_map_marker_on_order_update
  AFTER UPDATE OF gps_lat, gps_lng, gps_accuracy ON job_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_map_marker_on_order_update();

GRANT EXECUTE ON FUNCTION ensure_project_map_marker_on_order_insert() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_project_map_marker_on_order_update() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

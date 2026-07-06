-- Modul: Stavební body (Fotky na mapě)
-- Každý bod sdružuje více fotografií, poznámek a historii úprav.

CREATE TABLE construction_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  point_number INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL DEFAULT '',
  order_id UUID REFERENCES job_orders(id) ON DELETE SET NULL,
  gps_lat NUMERIC(10, 7) NOT NULL,
  gps_lng NUMERIC(10, 7) NOT NULL,
  gps_accuracy NUMERIC(10, 2),
  address_full TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE construction_point_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id UUID NOT NULL REFERENCES construction_points(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE construction_point_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id UUID NOT NULL REFERENCES construction_points(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gps_photos
  ADD COLUMN IF NOT EXISTS construction_point_id UUID REFERENCES construction_points(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_construction_points_order ON construction_points(order_id);
CREATE INDEX idx_construction_points_created ON construction_points(created_at DESC);
CREATE INDEX idx_construction_point_notes_point ON construction_point_notes(point_id);
CREATE INDEX idx_construction_point_history_point ON construction_point_history(point_id);
CREATE INDEX idx_gps_photos_construction_point ON gps_photos(construction_point_id);

CREATE TRIGGER construction_points_updated_at
  BEFORE UPDATE ON construction_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER construction_point_notes_updated_at
  BEFORE UPDATE ON construction_point_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE construction_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_point_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_point_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ERP čte stavební body"
  ON construction_points FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP vytváří stavební body"
  ON construction_points FOR INSERT
  WITH CHECK (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP upravuje stavební body"
  ON construction_points FOR UPDATE
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "Admin maže stavební body"
  ON construction_points FOR DELETE
  USING (get_user_role() = 'administrator');

CREATE POLICY "ERP čte poznámky bodů"
  ON construction_point_notes FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP spravuje poznámky bodů"
  ON construction_point_notes FOR ALL
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'))
  WITH CHECK (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP čte historii bodů"
  ON construction_point_history FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "ERP zapisuje historii bodů"
  ON construction_point_history FOR INSERT
  WITH CHECK (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

GRANT SELECT, INSERT, UPDATE, DELETE ON construction_points TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON construction_point_notes TO authenticated, service_role;
GRANT SELECT, INSERT ON construction_point_history TO authenticated, service_role;

-- Migrace existujících fotografií: každá fotka = vlastní stavební bod
DO $$
DECLARE
  r RECORD;
  new_id UUID;
  pt_num INTEGER;
BEGIN
  FOR r IN
    SELECT p.*
    FROM gps_photos p
    WHERE p.construction_point_id IS NULL
    ORDER BY p.created_at ASC
  LOOP
    SELECT COALESCE(MAX(cp.point_number), 0) + 1
    INTO pt_num
    FROM construction_points cp
    WHERE cp.order_id IS NOT DISTINCT FROM r.order_id;

    INSERT INTO construction_points (
      point_number,
      name,
      order_id,
      gps_lat,
      gps_lng,
      gps_accuracy,
      address_full,
      street,
      city,
      postal_code,
      country,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      pt_num,
      'Stavební bod ' || pt_num,
      r.order_id,
      r.gps_lat,
      r.gps_lng,
      r.gps_accuracy,
      COALESCE(r.address_full, ''),
      COALESCE(r.street, ''),
      COALESCE(r.city, ''),
      COALESCE(r.postal_code, ''),
      COALESCE(r.country, ''),
      r.created_by,
      r.created_at,
      r.updated_at
    )
    RETURNING id INTO new_id;

    UPDATE gps_photos
    SET construction_point_id = new_id, sort_order = 0
    WHERE id = r.id;

    INSERT INTO construction_point_history (point_id, action, details, performed_by, created_at)
    VALUES (
      new_id,
      'Bod vytvořen z existující fotografie',
      jsonb_build_object('photo_id', r.id),
      r.created_by,
      r.created_at
    );
  END LOOP;
END $$;

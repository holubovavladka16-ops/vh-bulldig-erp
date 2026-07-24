-- Modul – Mapa výkopů a měření trasy
-- Spusťte po 029_gps_photo_device_heading.sql

CREATE TABLE excavation_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT,
  color TEXT NOT NULL DEFAULT '#06b6d4',
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_length_m NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_length_m >= 0),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT excavation_routes_points_array CHECK (jsonb_typeof(points) = 'array')
);

CREATE INDEX idx_excavation_routes_order ON excavation_routes(order_id);
CREATE INDEX idx_excavation_routes_created ON excavation_routes(created_at DESC);

CREATE TRIGGER excavation_routes_updated_at
  BEFORE UPDATE ON excavation_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE excavation_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ERP uživatelé čtou trasy výkopů"
  ON excavation_routes FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "Admin spravuje trasy výkopů"
  ON excavation_routes FOR ALL
  USING (get_user_role() = 'administrator');

INSERT INTO erp_modules (id, label, path, icon, sort_order, is_implemented, module_version)
VALUES ('mapa-vykopu', 'Mapa výkopů', '/mapa-vykopu', 'Route', 13, true, '1.0.0')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  is_implemented = true,
  module_version = EXCLUDED.module_version;

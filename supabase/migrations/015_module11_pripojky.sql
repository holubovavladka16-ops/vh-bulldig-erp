-- Modul 11 – Přípojky
-- Spusťte po 014_module10_stavebni_denik.sql

CREATE TYPE utility_connection_work_type AS ENUM ('pripojka', 'jina');
CREATE TYPE utility_connection_photo_phase AS ENUM ('pred', 'po');

CREATE TABLE utility_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_date DATE NOT NULL,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  connection_address TEXT NOT NULL,
  work_description TEXT NOT NULL,
  length_meters NUMERIC(10, 2) NOT NULL CHECK (length_meters >= 0),
  penetration_count INTEGER NOT NULL CHECK (penetration_count >= 0),
  work_type utility_connection_work_type NOT NULL DEFAULT 'pripojka',
  diary_entry_id UUID REFERENCES construction_diary_entries(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gps_photos
  ADD COLUMN IF NOT EXISTS utility_connection_id UUID REFERENCES utility_connections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS photo_phase utility_connection_photo_phase;

CREATE INDEX idx_utility_connections_date ON utility_connections(connection_date DESC);
CREATE INDEX idx_utility_connections_order ON utility_connections(order_id);
CREATE INDEX idx_utility_connections_worker ON utility_connections(worker_id);
CREATE INDEX idx_gps_photos_connection ON gps_photos(utility_connection_id);

CREATE TRIGGER utility_connections_updated_at
  BEFORE UPDATE ON utility_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE utility_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin a vedoucí čtou přípojky"
  ON utility_connections FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci'));

CREATE POLICY "Admin spravuje přípojky"
  ON utility_connections FOR ALL
  USING (get_user_role() = 'administrator');

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0' WHERE id = 'pripojky';

-- Modul 10 – Stavební deník
-- Spusťte po 013_module9_fotodokumentace.sql

CREATE TABLE construction_diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  order_id UUID NOT NULL REFERENCES job_orders(id) ON DELETE RESTRICT,
  weather TEXT NOT NULL,
  worker_count INTEGER NOT NULL CHECK (worker_count >= 0),
  worker_names TEXT NOT NULL,
  equipment TEXT NOT NULL,
  work_description TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diary_entries_date ON construction_diary_entries(entry_date DESC);
CREATE INDEX idx_diary_entries_order ON construction_diary_entries(order_id);
CREATE INDEX idx_gps_photos_diary ON gps_photos(diary_entry_id);

ALTER TABLE gps_photos
  ADD CONSTRAINT gps_photos_diary_entry_id_fkey
  FOREIGN KEY (diary_entry_id) REFERENCES construction_diary_entries(id) ON DELETE CASCADE;

CREATE TRIGGER construction_diary_entries_updated_at
  BEFORE UPDATE ON construction_diary_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE construction_diary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ERP uživatelé čtou stavební deník"
  ON construction_diary_entries FOR SELECT
  USING (get_user_role() IN ('administrator', 'vedouci', 'delnik'));

CREATE POLICY "Admin vytváří zápisy deníku"
  ON construction_diary_entries FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje zápisy deníku"
  ON construction_diary_entries FOR UPDATE
  USING (get_user_role() = 'administrator');

CREATE POLICY "Admin maže zápisy deníku"
  ON construction_diary_entries FOR DELETE
  USING (get_user_role() = 'administrator');

UPDATE erp_modules SET is_implemented = true, module_version = '1.0.0', label = 'Stavební deník' WHERE id = 'denik';

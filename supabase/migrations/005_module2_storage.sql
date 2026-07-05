-- Modul 2 – Storage a portál fotografie
-- Spusťte po 004_module2_delnici.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('worker-photos', 'worker-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('worker-documents', 'worker-documents', false, 10485760, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autentizovaní nahrávají fotografie"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'worker-photos');

CREATE POLICY "Veřejné čtení fotografií"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'worker-photos');

CREATE POLICY "Anon nahrávají fotografie formuláře"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'worker-photos');

CREATE POLICY "Admin nahrává dokumenty"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'worker-documents');

CREATE POLICY "Autentizovaní čtou dokumenty"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'worker-documents');

CREATE OR REPLACE FUNCTION portal_add_form_photo(
  p_token UUID,
  p_form_id UUID,
  p_file_path TEXT,
  p_file_name TEXT
) RETURNS VOID AS $$
DECLARE
  v_worker_id UUID;
BEGIN
  SELECT w.id INTO v_worker_id FROM workers w WHERE w.portal_token = p_token AND w.status = 'aktivni';
  IF v_worker_id IS NULL THEN RAISE EXCEPTION 'Neplatný přístup'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM worker_daily_forms
    WHERE id = p_form_id AND worker_id = v_worker_id AND status IN ('koncept', 'k_oprave')
  ) THEN
    RAISE EXCEPTION 'Formulář nelze upravovat';
  END IF;

  INSERT INTO worker_form_photos (form_id, file_path, file_name)
  VALUES (p_form_id, p_file_path, p_file_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION portal_add_form_photo(UUID, UUID, TEXT, TEXT) TO anon, authenticated;

-- Oprava storage pro nahrávání fotografií zaměstnanců (upsert / přepsání)
DROP POLICY IF EXISTS "Autentizovaní aktualizují fotografie" ON storage.objects;
CREATE POLICY "Autentizovaní aktualizují fotografie"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'worker-photos');

DROP POLICY IF EXISTS "Autentizovaní mažou fotografie" ON storage.objects;
CREATE POLICY "Autentizovaní mažou fotografie"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'worker-photos');

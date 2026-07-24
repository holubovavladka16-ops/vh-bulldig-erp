-- Storage UPDATE/DELETE pro všechny ERP buckety (mazání dokumentů, fotek, upsert)
DO $$
DECLARE
  bucket TEXT;
BEGIN
  FOREACH bucket IN ARRAY ARRAY[
    'worker-documents',
    'gps-photos',
    'order-photos',
    'order-documents',
    'cost-photos',
    'cost-documents'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Auth update %1$s" ON storage.objects;
       CREATE POLICY "Auth update %1$s" ON storage.objects FOR UPDATE TO authenticated
         USING (bucket_id = %2$L);',
      bucket, bucket
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "Auth delete %1$s" ON storage.objects;
       CREATE POLICY "Auth delete %1$s" ON storage.objects FOR DELETE TO authenticated
         USING (bucket_id = %2$L);',
      bucket, bucket
    );
  END LOOP;
END $$;

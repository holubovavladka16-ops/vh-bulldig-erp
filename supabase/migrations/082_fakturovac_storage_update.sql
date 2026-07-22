-- Doplnění storage policy pro upsert (nahrazení loga/podpisu/razítka)
-- Spusťte po 081_fakturovac_module.sql

CREATE POLICY "Admin aktualizuje podklady faktur"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoice-assets')
  WITH CHECK (bucket_id = 'invoice-assets');

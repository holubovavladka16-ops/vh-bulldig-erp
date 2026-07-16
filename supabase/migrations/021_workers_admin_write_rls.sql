-- Explicitní RLS pro správu zaměstnanců administrátorem (konzistentní s migrací 018)

DROP POLICY IF EXISTS "Admin spravuje zaměstnance" ON workers;

CREATE POLICY "Admin vytváří zaměstnance"
  ON workers FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin upravuje zaměstnance"
  ON workers FOR UPDATE
  USING (get_user_role() = 'administrator')
  WITH CHECK (get_user_role() = 'administrator');

CREATE POLICY "Admin maže zaměstnance"
  ON workers FOR DELETE
  USING (get_user_role() = 'administrator');

-- Historie zaměstnance – admin může zapisovat (archivace, obnova stavu)
DROP POLICY IF EXISTS "Admin zapisuje historii" ON worker_history;
CREATE POLICY "Admin zapisuje historii"
  ON worker_history FOR INSERT
  WITH CHECK (get_user_role() = 'administrator');

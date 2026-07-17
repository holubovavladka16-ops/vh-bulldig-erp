-- Modul: Data a zálohy – oprávnění pro mazání záznamů kontroly formuláře

CREATE POLICY "Admin maže záznamy kontroly formuláře"
  ON form_check_records FOR DELETE
  USING (get_user_role() = 'administrator');

GRANT DELETE ON form_check_records TO authenticated;

NOTIFY pgrst, 'reload schema';

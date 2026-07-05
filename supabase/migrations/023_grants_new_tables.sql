-- Oprávnění pro nové tabulky z migrace 022
GRANT SELECT, INSERT, UPDATE, DELETE ON job_order_invoices TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Migrace 087 – Ochrana hlavičky uzavřeného výkazu i mimo UI/API vrstvu
-- Spusťte po 086_invoiceable_history_insert_policy.sql
--
-- Migrace 084 vytvořila ochranu proti úpravě ŘÁDKŮ uzavřeného výkazu
-- (trg_iwrl_block_closed), ale žádnou ochranu proti úpravě samotné
-- HLAVIČKY výkazu (název, období, objednatel, číslo smlouvy/objednávky,
-- poznámka). Doposud to bránila jen frontendová disabled pole – tedy
-- ne skutečně "nemožné upravit ani přes API", jak vyžaduje Fáze 6.
--
-- Trigger povoluje přechod stavu (uzavření/znovuotevření – tj. právě
-- probíhající změnu status), ale zablokuje jakoukoliv jinou změnu
-- hlavičky, pokud výkaz zůstává uzavřený (OLD i NEW status = 'uzavreny').
-- Žádná změna sloupců, žádná změna existujících dat.

CREATE OR REPLACE FUNCTION iwr_block_header_edit_when_closed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'uzavreny' AND NEW.status = 'uzavreny' THEN
    IF NEW.name IS DISTINCT FROM OLD.name
       OR NEW.period_from IS DISTINCT FROM OLD.period_from
       OR NEW.period_to IS DISTINCT FROM OLD.period_to
       OR NEW.note IS DISTINCT FROM OLD.note
       OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
       OR NEW.contract_number IS DISTINCT FROM OLD.contract_number
       OR NEW.purchase_order_number IS DISTINCT FROM OLD.purchase_order_number
    THEN
      RAISE EXCEPTION 'Uzavřený výkaz nelze upravovat. Nejprve jej znovu otevřete.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_iwr_block_header_edit
  BEFORE UPDATE ON invoiceable_work_reports
  FOR EACH ROW EXECUTE FUNCTION iwr_block_header_edit_when_closed();
